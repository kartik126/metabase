/* eslint-disable react/prop-types */
import cx from "classnames";
import { dissoc } from "icepick";
import { Component } from "react";
import { t } from "ttag";
import _ from "underscore";

import ActionButton from "metabase/components/ActionButton";
import Card from "metabase/components/Card";
import Button from "metabase/core/components/Button";
import Link from "metabase/core/components/Link";
import CS from "metabase/css/core/index.css";
import { DashboardTabs } from "metabase/dashboard/components/DashboardTabs";
import { DASHBOARD_PARAMETERS_PDF_EXPORT_NODE_ID } from "metabase/dashboard/constants";
import { Dashboard } from "metabase/dashboard/containers/Dashboard";
import { DashboardData } from "metabase/dashboard/hoc/DashboardData";
import { getIsHeaderVisible, getTabs } from "metabase/dashboard/selectors";
import Collections from "metabase/entities/collections";
import Dashboards from "metabase/entities/dashboards";
import title from "metabase/hoc/Title";
import { color } from "metabase/lib/colors";
import { connect } from "metabase/lib/redux";
import * as Urls from "metabase/lib/urls";
import { ParametersList } from "metabase/parameters/components/ParametersList";
import { addUndo } from "metabase/redux/undo";
import { getMetadata } from "metabase/selectors/metadata";
import { Box, Flex, Icon, Title, Tooltip } from "metabase/ui";
import { getValuePopulatedParameters } from "metabase-lib/v1/parameters/utils/parameter-values";

import { FixedWidthContainer } from "../components/Dashboard/DashboardComponents";
import { useDashboardUrlQuery } from "../hooks/use-dashboard-url-query";

import S from "./AutomaticDashboardApp.module.css";
import { XrayIcon } from "./XrayIcon";

const getDashboardId = (state, { params: { splat }, location: { hash } }) =>
  `/auto/dashboard/${splat}${hash.replace(/^#?/, "?")}`;

const mapStateToProps = (state, props) => ({
  metadata: getMetadata(state),
  dashboardId: getDashboardId(state, props),
  isHeaderVisible: getIsHeaderVisible(state),
  tabs: getTabs(state),
});

const mapDispatchToProps = {
  saveDashboard: Dashboards.actions.save,
  invalidateCollections: Collections.actions.invalidateLists,
  addUndo,
};

class AutomaticDashboardAppInner extends Component {
  state = {
    savedDashboardId: null,
  };

  componentDidUpdate(prevProps) {
    // scroll to the top when the pathname changes
    if (prevProps.location.pathname !== this.props.location.pathname) {
      window.scrollTo(0, 0);
    }
  }

  save = async () => {
    const { dashboard, addUndo, saveDashboard, invalidateCollections } =
      this.props;
    // remove the transient id before trying to save
    const { payload: newDashboard } = await saveDashboard(
      dissoc(dashboard, "id"),
    );
    invalidateCollections();
    addUndo({
      message: (
        <div className={cx(CS.flex, CS.alignCenter)}>
          {t`Your dashboard was saved`}
          <Link
            className={cx(CS.link, CS.textBold, CS.ml1)}
            to={Urls.dashboard(newDashboard)}
          >
            {t`See it`}
          </Link>
        </div>
      ),
      icon: "dashboard",
    });

    this.setState({ savedDashboardId: newDashboard.id });
  };

  UNSAFE_componentWillReceiveProps(nextProps) {
    // clear savedDashboardId if changing to a different dashboard
    if (this.props.location.pathname !== nextProps.location.pathname) {
      this.setState({ savedDashboardId: null });
    }
  }

  render() {
    const {
      dashboard,
      parameters,
      parameterValues,
      setParameterValue,
      isHeaderVisible,
    } = this.props;
    const { savedDashboardId } = this.state;
    // pull out "more" related items for displaying as a button at the bottom of the dashboard
    const more = dashboard && dashboard.more;
    const related = dashboard && dashboard.related;

    const hasSidebar = related && Object.keys(related).length > 0;

    return (
      <div
        className={cx(CS.relative, "AutomaticDashboard", {
          "AutomaticDashboard--withSidebar": hasSidebar,
        })}
      >
        <AutomaticDashboardQueryParamsSync
          router={this.props.router}
          location={this.props.location}
        />
        <div className="" style={{ marginRight: hasSidebar ? 346 : undefined }}>
          {isHeaderVisible && (
            <div
              className={cx(CS.bgWhite, CS.borderBottom)}
              data-testid="automatic-dashboard-header"
            >
              <div className={CS.wrapper}>
                <FixedWidthContainer
                  data-testid="fixed-width-dashboard-header"
                  isFixedWidth={dashboard?.width === "fixed"}
                >
                  <div className={cx(CS.flex, CS.alignCenter, CS.py2)}>
                    <XrayIcon />
                    <div>
                      <h2 className={cx(CS.textWrap, CS.mr2)}>
                        {dashboard && <TransientTitle dashboard={dashboard} />}
                      </h2>
                    </div>
                    {savedDashboardId != null ? (
                      <Button className={CS.mlAuto} disabled>{t`Saved`}</Button>
                    ) : (
                      <ActionButton
                        className={cx(CS.mlAuto, CS.textNoWrap)}
                        success
                        borderless
                        actionFn={this.save}
                      >
                        {t`Save this`}
                      </ActionButton>
                    )}
                  </div>
                  {this.props.tabs.length > 1 && (
                    <div className={cx(CS.wrapper, CS.flex, CS.alignCenter)}>
                      <DashboardTabs dashboardId={dashboard.id} />
                    </div>
                  )}
                </FixedWidthContainer>
              </div>
            </div>
          )}

          <div className={cx(CS.wrapper, CS.pb4)}>
            {parameters && parameters.length > 0 && (
              <div className={cx(CS.px1, CS.pt1)}>
                <FixedWidthContainer
                  id={DASHBOARD_PARAMETERS_PDF_EXPORT_NODE_ID}
                  data-testid="fixed-width-filters"
                  isFixedWidth={dashboard?.width === "fixed"}
                >
                  <ParametersList
                    className={CS.mt1}
                    parameters={getValuePopulatedParameters({
                      parameters,
                      values: parameterValues,
                    })}
                    setParameterValue={setParameterValue}
                  />
                </FixedWidthContainer>
              </div>
            )}
            <Dashboard isXray {...this.props} />
          </div>
          {more && (
            <div className={cx(CS.flex, CS.justifyEnd, CS.px4, CS.pb4)}>
              <Link to={more} className={CS.ml2}>
                <Button iconRight="chevronright">{t`Show more about this`}</Button>
              </Link>
            </div>
          )}
        </div>
        {hasSidebar && (
          <Box
            className={cx(
              CS.absolute,
              CS.top,
              CS.right,
              CS.bottom,
              S.SuggestionsSidebarWrapper,
            )}
          >
            <SuggestionsSidebar related={related} />
          </Box>
        )}
      </div>
    );
  }
}

export const AutomaticDashboardAppConnected = _.compose(
  connect(mapStateToProps, mapDispatchToProps),
  DashboardData,
  title(({ dashboard }) => dashboard && dashboard.name),
)(AutomaticDashboardAppInner);

const TransientTitle = ({ dashboard }) =>
  dashboard.transient_name ? (
    <span>{dashboard.transient_name}</span>
  ) : dashboard.name ? (
    <span>{dashboard.name}</span>
  ) : null;

const RELATED_CONTENT = {
  compare: {
    get title() {
      return t`Compare`;
    },
    icon: "compare",
  },
  "zoom-in": {
    get title() {
      return t`Zoom in`;
    },
    icon: "zoom_in",
  },
  "zoom-out": {
    get title() {
      return t`Zoom out`;
    },
    icon: "zoom_out",
  },
  related: {
    get title() {
      return t`Related`;
    },
    icon: "connections",
  },
};

const SuggestionsList = ({ suggestions, section }) => (
  <Box component="ol" my="sm">
    {Object.keys(suggestions).map((s, i) => (
      <li key={i} className={CS.my2}>
        <SuggestionSectionHeading>
          {RELATED_CONTENT[s].title}
        </SuggestionSectionHeading>
        {suggestions[s].length > 0 &&
          suggestions[s].map((item, itemIndex) => (
            <Link
              key={itemIndex}
              to={item.url}
              className={cx(CS.hoverParent, CS.hoverVisibility, S.ItemLink)}
            >
              <Card className={CS.p2} hoverable>
                <Flex align="center">
                  <Icon
                    name={RELATED_CONTENT[s].icon}
                    color={color("accent4")}
                    className={CS.mr1}
                  />
                  <h4 className={CS.textWrap}>{item.title}</h4>
                  <Box ml="auto" className={CS.hoverChild}>
                    <Tooltip label={item.description}>
                      <Icon name="info_outline" color={color("bg-dark")} />
                    </Tooltip>
                  </Box>
                </Flex>
              </Card>
            </Link>
          ))}
      </li>
    ))}
  </Box>
);

const SuggestionSectionHeading = ({ children }) => (
  <h5
    style={{
      fontWeight: 900,
      textTransform: "uppercase",
      color: color("text-medium"),
    }}
    className={CS.mb1}
  >
    {children}
  </h5>
);

const SuggestionsSidebar = ({ related }) => (
  <Flex direction="column" py="md" px="xl">
    <Title py="sm" px={0} order={2}>{t`More X-rays`}</Title>
    <SuggestionsList suggestions={related} />
  </Flex>
);

// Workaround until AutomaticDashboardApp is refactored to be a function component
// (or even better, merged/generalized with DashboardApp)
const AutomaticDashboardQueryParamsSync = ({ router, location }) => {
  useDashboardUrlQuery(router, location);
  return null;
};
