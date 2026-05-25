# Personal Academic Website

Static academic homepage powered by Markdown and BibTeX. It can be deployed for free with GitHub Pages.

## Edit Content

- Basic profile, links, contact: `data/site.json`
- Biography: `content/profile.md`
- News: `content/news.md`
- Publications: `content/publications.bib`
- Gallery images: `content/gallery.md`
- Profile photo and site icon: `assets/`

## Local Preview

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:8765
```

## News

Add new items at the top of `content/news.md`:

```markdown
- 2026-05-25: Your news item with :sparkles: or regular emoji.
```

## Publications

Add standard BibTeX entries to `content/publications.bib`. The site recognizes:

```text
preview, paper, arxiv, project, code, data, poster, slides, video, demo, supplement, doi, url
```

Example:

```bibtex
@article{key2026,
  title = {Paper Title},
  author = {Last, First and Last, First},
  journal = {Journal Name},
  year = {2026},
  preview = {assets/publication_preview/key2026.jpg},
  paper = {https://example.com/paper.pdf},
  project = {https://example.com/project},
  code = {https://github.com/example/repo}
}
```

## Gallery

Put gallery images in `assets/gallery/`, then list them in `content/gallery.md`:

```markdown
- ![Caption for the image](assets/gallery/my-image.jpg)
```

## GitHub Pages Deployment

This repository includes `.github/workflows/pages.yml`, which deploys the site automatically with GitHub Pages. GitHub Pages is free for public repositories and does not require a paid upgrade.

To publish at `https://dxue321.github.io/`, create a public GitHub repository named:

```text
dxue321.github.io
```

Push this project to the `main` branch. In the repository settings, set:

```text
Settings -> Pages -> Source: GitHub Actions
```

After every push to `main`, GitHub will deploy the site automatically.
