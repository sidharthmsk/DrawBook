export function AiSection({
  groqApiKey,
  setGroqApiKey,
  hasGroqKey,
  onMarkDirty,
}: {
  groqApiKey: string;
  setGroqApiKey: (v: string) => void;
  hasGroqKey: boolean;
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
          <path d="M12 2a4 4 0 014 4c0 1.95-1.4 3.58-3.25 3.93L12 22l-.75-12.07A4.001 4.001 0 0112 2z" />
          <path d="M8 10a4 4 0 00-4 4c0 1.95 1.4 3.58 3.25 3.93" />
          <path d="M16 10a4 4 0 014 4c0 1.95-1.4 3.58-3.25 3.93" />
        </svg>
        AI
      </h3>

      <div className="settings-field">
        <label>
          Groq API Key
          {hasGroqKey && (
            <span className="settings-field__badge">Configured</span>
          )}
        </label>
        <input
          type="password"
          value={groqApiKey}
          onChange={(e) => {
            setGroqApiKey(e.target.value);
            onMarkDirty();
          }}
          placeholder={hasGroqKey ? "****" : "Enter your Groq API key"}
        />
        <span className="settings-field__hint">
          Get your API key at{" "}
          <a
            href="https://console.groq.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            console.groq.com
          </a>
        </span>
      </div>
    </section>
  );
}
