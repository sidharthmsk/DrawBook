export function SecuritySection({
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  hasPassword,
  onSave,
  saving,
  passwordDirty,
  setPasswordDirty,
}: {
  currentPassword: string;
  setCurrentPassword: (v: string) => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  hasPassword: boolean;
  onSave: () => void;
  saving: boolean;
  passwordDirty: boolean;
  setPasswordDirty: (v: boolean) => void;
}) {
  return (
    <section className="settings-section">
      <h3 className="settings-section__title">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
        Security
      </h3>

      {hasPassword ? (
        <div className="settings-password-group">
          <div className="settings-field">
            <label>Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setPasswordDirty(true);
              }}
              placeholder="Enter current password"
            />
          </div>
          <div className="settings-field">
            <label>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setPasswordDirty(true);
              }}
              placeholder="Enter new password"
            />
          </div>
          <div className="settings-field">
            <label>Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setPasswordDirty(true);
              }}
              placeholder="Confirm new password"
            />
          </div>
          <button
            className="primary-btn settings-password-btn"
            disabled={saving || !passwordDirty}
            onClick={onSave}
          >
            {saving ? "Saving..." : "Change Password"}
          </button>
        </div>
      ) : (
        <div className="settings-password-group">
          <p className="settings-field__hint">
            No password is currently set. Set one to protect your instance.
          </p>
          <div className="settings-field">
            <label>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setPasswordDirty(true);
              }}
              placeholder="Set a password"
            />
          </div>
          <div className="settings-field">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setPasswordDirty(true);
              }}
              placeholder="Confirm password"
            />
          </div>
          <button
            className="primary-btn settings-password-btn"
            disabled={saving || !passwordDirty}
            onClick={onSave}
          >
            {saving ? "Saving..." : "Set Password"}
          </button>
        </div>
      )}
    </section>
  );
}
