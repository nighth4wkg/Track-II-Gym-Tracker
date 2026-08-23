"use client";

import type { ChangeEvent, KeyboardEvent } from "react";
import { TRACK_LIMITS } from "../trackConstants";

type AccountPromptModalsProps = {
  usernamePromptOpen: boolean;
  usernameInput: string;
  usernameMessage: string;
  usernameSaving: boolean;
  onUsernameInputChange: (value: string) => void;
  onSaveUsername: () => void | Promise<void>;
  personalInfoPromptOpen: boolean;
  personalHeightInput: string;
  personalWeightInput: string;
  personalInfoMessage: string;
  personalInfoSaving: boolean;
  onPersonalHeightChange: (value: string) => void;
  onPersonalWeightChange: (value: string) => void;
  onSavePersonalInfo: () => void | Promise<void>;
  passwordResetOpen: boolean;
  passwordResetBusy: boolean;
  passwordResetValue: string;
  passwordResetConfirm: string;
  passwordResetMessage: string;
  onPasswordResetValueChange: (value: string) => void;
  onPasswordResetConfirmChange: (value: string) => void;
  onClosePasswordReset: () => void;
  onSavePasswordReset: () => void | Promise<void>;
};

export function AccountPromptModals({
  usernamePromptOpen,
  usernameInput,
  usernameMessage,
  usernameSaving,
  onUsernameInputChange,
  onSaveUsername,
  personalInfoPromptOpen,
  personalHeightInput,
  personalWeightInput,
  personalInfoMessage,
  personalInfoSaving,
  onPersonalHeightChange,
  onPersonalWeightChange,
  onSavePersonalInfo,
  passwordResetOpen,
  passwordResetBusy,
  passwordResetValue,
  passwordResetConfirm,
  passwordResetMessage,
  onPasswordResetValueChange,
  onPasswordResetConfirmChange,
  onClosePasswordReset,
  onSavePasswordReset,
}: AccountPromptModalsProps) {
  const submitOnEnter = (event: KeyboardEvent<HTMLInputElement>, submit: () => void | Promise<void>) => {
    if (event.key === "Enter") void submit();
  };

  return (
    <>
      {usernamePromptOpen && (
        <div className="username-prompt-backdrop">
          <section className="username-prompt" role="dialog" aria-modal="true" aria-labelledby="username-prompt-title">
            <div className="username-prompt-mark">
              <span className="dumbbell-icon" />
            </div>
            <span className="settings-kicker">WELCOME TO TRACK II</span>
            <h2 id="username-prompt-title">Choose your username</h2>
            <p>
              This name identifies you across your devices and lets the administrator find your shared workout profile.
            </p>
            <label>
              Username
              <input
                value={usernameInput}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  onUsernameInputChange(event.target.value.slice(0, TRACK_LIMITS.maxUsernameChars))
                }
                onKeyDown={(event) => submitOnEnter(event, onSaveUsername)}
                autoFocus
                autoComplete="username"
                maxLength={TRACK_LIMITS.maxUsernameChars}
              />
            </label>
            {usernameMessage && (
              <div className="username-prompt-error" role="alert">
                {usernameMessage}
              </div>
            )}
            <button className="username-prompt-save" onClick={() => void onSaveUsername()} disabled={usernameSaving}>
              {usernameSaving ? "Saving…" : "Continue"}
            </button>
          </section>
        </div>
      )}
      {personalInfoPromptOpen && !usernamePromptOpen && (
        <div className="personal-info-prompt-backdrop">
          <section
            className="personal-info-prompt"
            role="dialog"
            aria-modal="true"
            aria-labelledby="personal-info-prompt-title"
          >
            <div className="username-prompt-mark">
              <span className="dumbbell-icon" />
            </div>
            <span className="settings-kicker">PERSONALIZE YOUR RANK</span>
            <h2 id="personal-info-prompt-title">Complete your profile</h2>
            <p>
              Height and bodyweight help Track II calculate a fairer strength rank. You can update them later in
              Settings.
            </p>
            <div className="personal-info-fields">
              <label>
                Height
                <div>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={TRACK_LIMITS.minHeightCm}
                    max={TRACK_LIMITS.maxHeightCm}
                    step="0.1"
                    value={personalHeightInput}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => onPersonalHeightChange(event.target.value)}
                    onKeyDown={(event) => submitOnEnter(event, onSavePersonalInfo)}
                    autoFocus
                  />
                  <small>cm</small>
                </div>
              </label>
              <label>
                Bodyweight
                <div>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={TRACK_LIMITS.minWeightKg}
                    max={TRACK_LIMITS.maxWeightKg}
                    step="0.1"
                    value={personalWeightInput}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => onPersonalWeightChange(event.target.value)}
                    onKeyDown={(event) => submitOnEnter(event, onSavePersonalInfo)}
                  />
                  <small>kg</small>
                </div>
              </label>
            </div>
            {personalInfoMessage && (
              <div className="username-prompt-error" role="alert">
                {personalInfoMessage}
              </div>
            )}
            <button
              className="username-prompt-save"
              onClick={() => void onSavePersonalInfo()}
              disabled={personalInfoSaving}
            >
              {personalInfoSaving ? "Saving…" : "Done"}
            </button>
          </section>
        </div>
      )}
      {passwordResetOpen && (
        <div
          className="password-reset-backdrop"
          onMouseDown={() => {
            if (!passwordResetBusy) onClosePasswordReset();
          }}
        >
          <section
            className="password-reset-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-reset-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="password-reset-close"
              onClick={onClosePasswordReset}
              disabled={passwordResetBusy}
              aria-label="Close password reset"
            >
              ×
            </button>
            <div className="password-reset-mark">
              <span className="dumbbell-icon" />
            </div>
            <span className="settings-kicker">TRACK II ACCOUNT</span>
            <h2 id="password-reset-title">Set a new password</h2>
            <p>Choose a new password for your Track II account, then confirm it below.</p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void onSavePasswordReset();
              }}
            >
              <label>
                New password
                <input
                  type="password"
                  value={passwordResetValue}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onPasswordResetValueChange(event.target.value)}
                  autoComplete="new-password"
                  minLength={6}
                  autoFocus
                  required
                />
              </label>
              <label>
                Confirm new password
                <input
                  type="password"
                  value={passwordResetConfirm}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onPasswordResetConfirmChange(event.target.value)}
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </label>
              {passwordResetMessage && (
                <div className="auth-message" role="alert">
                  {passwordResetMessage}
                </div>
              )}
              <button className="password-reset-save" type="submit" disabled={passwordResetBusy}>
                {passwordResetBusy ? "Updating..." : "Update password"}
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
