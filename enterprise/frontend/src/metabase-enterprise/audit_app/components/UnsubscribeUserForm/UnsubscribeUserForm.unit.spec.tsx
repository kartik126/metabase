import { render, screen, waitFor } from "__support__/ui";
import { createMockUser } from "metabase-types/api/mocks";

import { UnsubscribeUserForm } from "./UnsubscribeUserForm";

const getUser = () =>
  createMockUser({
    id: 1,
    common_name: "John Doe",
  });

describe("UnsubscribeUserForm", () => {
  it("should close on successful submit", async () => {
    const user = getUser();
    const onUnsubscribe = jest.fn();
    const onClose = jest.fn();

    render(
      <UnsubscribeUserForm
        user={user}
        onUnsubscribe={onUnsubscribe}
        onClose={onClose}
      />,
    );

    screen.getByText("Unsubscribe").click();

    await waitFor(() => {
      expect(onUnsubscribe).toHaveBeenCalled();
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("should display a message on submit failure", async () => {
    const user = getUser();
    const error = { data: { message: "error" } };
    const onUnsubscribe = jest.fn().mockRejectedValue(error);
    const onClose = jest.fn();

    render(
      <UnsubscribeUserForm
        user={user}
        onUnsubscribe={onUnsubscribe}
        onClose={onClose}
      />,
    );

    screen.getByText("Unsubscribe").click();

    expect(await screen.findByText(error.data.message)).toBeInTheDocument();
    expect(onUnsubscribe).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
