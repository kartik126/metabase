(ns metabase.api.logger-test
  (:require
   [clojure.test :refer :all]
   [metabase.logger :as logger]
   [metabase.test :as mt]))

(set! *warn-on-reflection* true)

(deftest ^:parallel presets-test
  (testing "non-admins have no access"
    (mt/user-http-request :lucky :get 403 "logger/presets"))
  (testing "admins have access"
    (is (=? [{:id "sync"
              :display_name "Sync issue troubleshooting"
              :loggers #(every? (every-pred :name :level) %)}]
            (mt/user-http-request :crowberto :get 200 "logger/presets")))))

(deftest ^:parallel adjust-invocation-error-test
  (testing "wrong duration"
    (mt/user-http-request :crowberto :post 400 "logger/adjustment"
                          {:duration "1," :duration_unit :days, :log_levels {"l" :debug}}))
  (testing "wrong duration unit"
    (mt/user-http-request :crowberto :post 400 "logger/adjustment"
                          {:duration 1, :duration_unit :weeks, :log_levels {"l" :debug}}))
  (testing "wrong log level"
    (mt/user-http-request :crowberto :post 400 "logger/adjustment"
                          {:duration 1, :duration_unit :days, :log_levels {"l" :catastophic}}))
  (testing "non-admins have no access"
    (mt/user-http-request :lucky :post 403 "logger/adjustment" {:duration 1, :duration_unit :days, :log_levels {"l" "debug"}})))

(deftest ^:sequential adjust-test
  (let [trace-ns (str (random-uuid))
        fatal-ns (str (random-uuid))
        other-ns (str (random-uuid))
        log-levels {trace-ns :trace, fatal-ns :fatal}
        timeout-ms 200]
    (logger/set-ns-log-level! trace-ns :info)
    (try
      (testing "sanity check the pristine state"
        (is (= :info (logger/ns-log-level trace-ns)))
        (is (nil? (logger/exact-ns-logger fatal-ns)))
        (is (nil? (logger/exact-ns-logger other-ns))))

      (testing "overriding multiple namespaces works"
        (mt/user-http-request :crowberto :post 204 "logger/adjustment"
                              {:duration timeout-ms, :duration_unit :milliseconds, :log_levels log-levels})
        (is (= :trace (logger/ns-log-level trace-ns)))
        (is (= :fatal (logger/ns-log-level fatal-ns)))
        (is (nil? (logger/exact-ns-logger other-ns))))

      (testing "a new override cancels the previous one"
        (mt/user-http-request :crowberto :post 204 "logger/adjustment"
                              {:duration timeout-ms, :duration_unit :milliseconds, :log_levels {other-ns :trace}})
        (is (= :info (logger/ns-log-level trace-ns)))
        (is (nil? (logger/exact-ns-logger fatal-ns)))
        (is (= :trace (logger/ns-log-level other-ns))))

      (testing "the override is automatically undone when the timeout is reached"
        (let [limit (+ (System/currentTimeMillis) timeout-ms 5000)]
          (loop []
            (cond
              (nil? (logger/exact-ns-logger other-ns))
              (testing "levels for namespaces not mentioned should not change"
                (is (= :info (logger/ns-log-level trace-ns)))
                (is (nil? (logger/exact-ns-logger fatal-ns))))

              (< (System/currentTimeMillis) limit)
              (recur)

              :else
              (is (nil? (logger/exact-ns-logger other-ns)) "the change has not been undone automatically")))))

      (testing "empty adjustment works"
        (mt/user-http-request :crowberto :post 204 "logger/adjustment"
                              {:duration timeout-ms, :duration_unit :milliseconds, :log_levels {}})
        (is (= :info (logger/ns-log-level trace-ns)))
        (is (nil? (logger/exact-ns-logger fatal-ns)))

        (testing "empty adjustment works a second time too"
          (mt/user-http-request :crowberto :post 204 "logger/adjustment"
                                {:duration timeout-ms, :duration_unit :milliseconds, :log_levels {}})
          (is (= :info (logger/ns-log-level trace-ns)))
          (is (nil? (logger/exact-ns-logger fatal-ns)))))
      (finally
        (logger/remove-ns-logger! trace-ns)
        (logger/remove-ns-logger! fatal-ns)
        (logger/remove-ns-logger! other-ns)))))

(deftest ^:sequential delete-test
  (let [trace-ns (str (random-uuid))
        fatal-ns (str (random-uuid))
        log-levels {trace-ns :trace, fatal-ns :fatal}
        timeout-hours 2]
    (try
      (logger/set-ns-log-level! trace-ns :info)
      (testing "overriding multiple namespaces works"
        (mt/user-http-request :crowberto :post 204 "logger/adjustment"
                              {:duration timeout-hours, :duration_unit :hours, :log_levels log-levels})
        (is (= :trace (logger/ns-log-level trace-ns)))
        (is (= :fatal (logger/ns-log-level fatal-ns))))

      (testing "only admins can delete"
        (mt/user-http-request :lucky :delete 403 "logger/adjustment")
        (is (= :trace (logger/ns-log-level trace-ns)))
        (is (= :fatal (logger/ns-log-level fatal-ns))))

      (testing "delete undoes the adjustments"
        (mt/user-http-request :crowberto :delete 204 "logger/adjustment")
        (is (= :info (logger/ns-log-level trace-ns)))
        (is (nil? (logger/exact-ns-logger fatal-ns))))

      (testing "second delete is OK"
        (mt/user-http-request :crowberto :delete 204 "logger/adjustment")
        (is (= :info (logger/ns-log-level trace-ns)))
        (is (nil? (logger/exact-ns-logger fatal-ns))))
      (finally
        (logger/remove-ns-logger! trace-ns)
        (logger/remove-ns-logger! fatal-ns)))))
