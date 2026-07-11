window.__CONFIG__ = {
  // The URL for the CORS proxy, the URL must NOT end with a slash!
  // If not specified, the onboarding will not allow a "default setup". The user will have to use the extension or set up a proxy themselves
  VITE_CORS_PROXY_URL: "",

  // The READ API key to access TMDB
  VITE_TMDB_READ_API_KEY: "",

  // The DMCA email displayed in the footer, null to hide the DMCA link
  VITE_DMCA_EMAIL: null,

  // Whether to disable hash-based routing, leave this as false if you don't know what this is
  VITE_NORMAL_ROUTER: true,

  // The backend URL(s) to communicate with - can be a single URL or comma-separated list (e.g., "https://server1.com,https://server2.com")
  // Set VITE_BACKEND_URL as a Vercel/build environment variable instead of here.
  VITE_BACKEND_URL: null,

  // A comma separated list of disallowed IDs in the case of a DMCA claim - in the format "series-<id>" and "movie-<id>"
  VITE_DISALLOWED_IDS: "",

  // Allowing TopWaatch 4K (Febbox) to be enabled.
  VITE_ALLOW_FEBBOX_KEY: "true",

  // Febbox web authorize  https://www.febbox.com/open/client
  // Set VITE_FEBBOX_CLIENT_ID and VITE_FEBBOX_REDIRECT_URI as Vercel/build environment variables.
  // Do NOT put real values here — this file is public and tracked in git.
  VITE_FEBBOX_CLIENT_ID: null,
  VITE_FEBBOX_REDIRECT_URI: null,
};
