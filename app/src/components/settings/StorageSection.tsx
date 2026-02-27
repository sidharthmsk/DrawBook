export function StorageSection({
  storageBackend,
  setStorageBackend,
  minioEndpointUrl,
  setMinioEndpointUrl,
  minioAccessKey,
  setMinioAccessKey,
  minioSecretKey,
  setMinioSecretKey,
  minioBucket,
  setMinioBucket,
  minioRegion,
  setMinioRegion,
  minioPrefix,
  setMinioPrefix,
  hasMinioCredentials,
  onMarkDirty,
}: {
  storageBackend: string;
  setStorageBackend: (v: string) => void;
  minioEndpointUrl: string;
  setMinioEndpointUrl: (v: string) => void;
  minioAccessKey: string;
  setMinioAccessKey: (v: string) => void;
  minioSecretKey: string;
  setMinioSecretKey: (v: string) => void;
  minioBucket: string;
  setMinioBucket: (v: string) => void;
  minioRegion: string;
  setMinioRegion: (v: string) => void;
  minioPrefix: string;
  setMinioPrefix: (v: string) => void;
  hasMinioCredentials: boolean;
  onMarkDirty: () => void;
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
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
        Storage
      </h3>

      <div className="settings-field">
        <label>Storage Backend</label>
        <div className="settings-radio-group">
          <label
            className={`settings-radio ${storageBackend === "local" ? "settings-radio--active" : ""}`}
          >
            <input
              type="radio"
              name="storageBackend"
              value="local"
              checked={storageBackend === "local"}
              onChange={() => {
                setStorageBackend("local");
                onMarkDirty();
              }}
            />
            <span className="settings-radio__dot" />
            <span>Local filesystem</span>
          </label>
          <label
            className={`settings-radio ${storageBackend === "minio" ? "settings-radio--active" : ""}`}
          >
            <input
              type="radio"
              name="storageBackend"
              value="minio"
              checked={storageBackend === "minio"}
              onChange={() => {
                setStorageBackend("minio");
                onMarkDirty();
              }}
            />
            <span className="settings-radio__dot" />
            <span>MinIO / S3-compatible</span>
          </label>
        </div>
      </div>

      {storageBackend === "minio" && (
        <div className="settings-minio-fields">
          <div className="settings-field">
            <label>Endpoint URL</label>
            <input
              type="text"
              value={minioEndpointUrl}
              onChange={(e) => {
                setMinioEndpointUrl(e.target.value);
                onMarkDirty();
              }}
              placeholder="http://localhost:9000"
            />
          </div>
          <div className="settings-field-row">
            <div className="settings-field">
              <label>Access Key</label>
              <input
                type="password"
                value={minioAccessKey}
                onChange={(e) => {
                  setMinioAccessKey(e.target.value);
                  onMarkDirty();
                }}
                placeholder={hasMinioCredentials ? "****" : "Access key"}
              />
            </div>
            <div className="settings-field">
              <label>Secret Key</label>
              <input
                type="password"
                value={minioSecretKey}
                onChange={(e) => {
                  setMinioSecretKey(e.target.value);
                  onMarkDirty();
                }}
                placeholder={hasMinioCredentials ? "****" : "Secret key"}
              />
            </div>
          </div>
          <div className="settings-field-row">
            <div className="settings-field">
              <label>Bucket</label>
              <input
                type="text"
                value={minioBucket}
                onChange={(e) => {
                  setMinioBucket(e.target.value);
                  onMarkDirty();
                }}
                placeholder="drawbook"
              />
            </div>
            <div className="settings-field">
              <label>Region</label>
              <input
                type="text"
                value={minioRegion}
                onChange={(e) => {
                  setMinioRegion(e.target.value);
                  onMarkDirty();
                }}
                placeholder="us-east-1"
              />
            </div>
          </div>
          <div className="settings-field">
            <label>
              Key Prefix{" "}
              <span className="settings-field__optional">(optional)</span>
            </label>
            <input
              type="text"
              value={minioPrefix}
              onChange={(e) => {
                setMinioPrefix(e.target.value);
                onMarkDirty();
              }}
              placeholder="e.g. drawbook/"
            />
          </div>
        </div>
      )}
    </section>
  );
}
