# Local development

The production HTML always references the published assets at
`https://tiekoetternet-cdn.tiekoetter.cloud/assets/as/`.

For local development, run the development server from the repository root:

```sh
python3 .dev/server.py
```

Then open `http://127.0.0.1:8000/`. The development server rewrites the CDN asset
URLs in HTML responses to the reference files under `.dev/assets/` and disables
caching. It never exposes dot-directories.

For deployment, publish or symlink `.dev/assets/` at the CDN's `/assets/as/` path
before or together with the website. Increment the `?v=` value in the HTML whenever
a published asset changes so existing clients bypass the CDN cache.
