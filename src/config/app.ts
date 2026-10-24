export interface NavItem {
  path: string
  label: string
  /** The real endpoint this screen will consume. */
  endpoint: string
  blurb: string
}

export const appConfig = {
  title: 'Linen Room',
  tagline: 'Scan in, scan out, keep the count honest',
  authKind: 'staff' as 'staff' | 'client',
  /** /auth/login — the only sign-in this app may call. */
  loginPath: '/auth/login',
  statusPath: '/auth/status',
  nav: [
    {
      "path": "/",
      "label": "Scan",
      "endpoint": "POST /linens/{id}/scan",
      "blurb": "Camera or gun scanner: collect, receive, ready, deliver."
    },
    {
      "path": "/inventory",
      "label": "Inventory",
      "endpoint": "GET /linens",
      "blurb": "Where every tagged piece is right now."
    },
    {
      "path": "/discrepancies",
      "label": "Discrepancies",
      "endpoint": "GET /linens/stats/summary",
      "blurb": "Missing and damaged pieces that need a decision."
    },
    {
      "path": "/tags",
      "label": "Tags",
      "endpoint": "POST /linens/generate-tags",
      "blurb": "Print new tags for pieces entering circulation."
    }
  ] as NavItem[],
}
