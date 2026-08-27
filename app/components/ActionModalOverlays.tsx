"use client";

type ActionModalOverlaysProps = {
  pendingExerciseName: string;
  onCancelPendingExercise: () => void;
  onConfirmPendingExercise: (name: string) => void | Promise<void>;
  signOutConfirm: boolean;
  onCloseSignOut: () => void;
  onSignOut: () => void | Promise<void>;
  deleteAccountConfirm: boolean;
  deleteAccountBusy: boolean;
  deleteAccountMessage: string;
  onCloseDeleteAccount: () => void;
  onDeleteAccount: () => void | Promise<void>;
  notificationPrompt: boolean;
  notificationRequestBusy: boolean;
  onDismissNotification: () => void;
  onRequestNotifications: () => void | Promise<void>;
};

export function ActionModalOverlays({
  pendingExerciseName,
  onCancelPendingExercise,
  onConfirmPendingExercise,
  signOutConfirm,
  onCloseSignOut,
  onSignOut,
  deleteAccountConfirm,
  deleteAccountBusy,
  deleteAccountMessage,
  onCloseDeleteAccount,
  onDeleteAccount,
  notificationPrompt,
  notificationRequestBusy,
  onDismissNotification,
  onRequestNotifications,
}: ActionModalOverlaysProps) {
  return (
    <>
      {pendingExerciseName && (
        <div className="exercise-confirm-backdrop" onMouseDown={onCancelPendingExercise}>
          <section
            className="exercise-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="exercise-confirm-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="exercise-confirm-mark">
              <span className="dumbbell-icon" />
            </div>
            <span className="settings-kicker">CUSTOM EXERCISE</span>
            <h2 id="exercise-confirm-title">Add “{pendingExerciseName}”?</h2>
            <p>We couldn’t find this in Track II’s exercise library. Are you sure this is the exercise you want?</p>
            <div className="exercise-confirm-actions">
              <button
                className="exercise-confirm-yes"
                onClick={() => void onConfirmPendingExercise(pendingExerciseName)}
              >
                Yes, add it
              </button>
              <button className="exercise-confirm-no" onClick={onCancelPendingExercise}>
                No
              </button>
            </div>
          </section>
        </div>
      )}
      {signOutConfirm && (
        <div className="exercise-confirm-backdrop" onMouseDown={onCloseSignOut}>
          <section
            className="exercise-confirm signout-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="signout-confirm-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="exercise-confirm-mark">
              <span className="dumbbell-icon" />
            </div>
            <span className="settings-kicker">ACCOUNT</span>
            <h2 id="signout-confirm-title">Sign out of Track II?</h2>
            <p>Your workouts are saved online. You’ll need to sign in again to continue tracking.</p>
            <div className="exercise-confirm-actions signout-confirm-actions">
              <button className="signout-stay" onClick={onCloseSignOut}>
                Stay signed in
              </button>
              <button className="signout-leave" onClick={() => void onSignOut()}>
                Sign out
              </button>
            </div>
          </section>
        </div>
      )}
      {deleteAccountConfirm && (
        <div className="exercise-confirm-backdrop" onMouseDown={onCloseDeleteAccount}>
          <section
            className="exercise-confirm signout-confirm delete-account-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-account-confirm-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="exercise-confirm-mark is-danger">
              <span aria-hidden="true">!</span>
            </div>
            <span className="settings-kicker">PERMANENT ACTION</span>
            <h2 id="delete-account-confirm-title">Delete your account?</h2>
            <p>
              This permanently deletes your Track II account, workout history, splits, profile, and synced data. This
              cannot be undone.
            </p>
            {deleteAccountMessage && <p className="settings-inline-message is-error">{deleteAccountMessage}</p>}
            <div className="exercise-confirm-actions signout-confirm-actions">
              <button className="signout-stay" onClick={onCloseDeleteAccount} disabled={deleteAccountBusy}>
                Keep account
              </button>
              <button className="signout-leave" onClick={() => void onDeleteAccount()} disabled={deleteAccountBusy}>
                {deleteAccountBusy ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </section>
        </div>
      )}
      {notificationPrompt && (
        <div className="exercise-confirm-backdrop notification-permission-backdrop" onMouseDown={onDismissNotification}>
          <section
            className="exercise-confirm notification-permission-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-permission-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="exercise-confirm-mark">
              <span className="notification-bell" />
            </div>
            <span className="settings-kicker">TRACK II ANNOUNCEMENTS</span>
            <h2 id="notification-permission-title">Stay in the loop?</h2>
            <p>
              Allow Track II to show rest timer alerts and administrator announcements in your device notifications. You
              can change this later in Privacy &amp; Notifications.
            </p>
            <div className="exercise-confirm-actions notification-permission-actions">
              <button
                className="exercise-confirm-yes"
                onClick={() => void onRequestNotifications()}
                disabled={notificationRequestBusy}
              >
                {notificationRequestBusy ? "Opening permissions…" : "Allow notifications"}
              </button>
              <button className="notification-later" onClick={onDismissNotification} disabled={notificationRequestBusy}>
                Not now
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
