type SeoInput = {
  title: string
  description: string
  path?: string
}

const SITE_NAME = 'Pixel Toolbox'

function setMetaTag(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    document.head.appendChild(el)
  }
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value)
  }
}

function setLinkTag(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export function applySeo({ title, description, path }: SeoInput) {
  if (typeof document === 'undefined') return

  document.title = title

  const normalizedPath = path ? (path.startsWith('/') ? path.slice(1) : path) : window.location.pathname.replace(/^\/+/, '')
  const url = new URL(`${import.meta.env.BASE_URL}${normalizedPath}`, window.location.origin).toString()
  const imageUrl = new URL(`${import.meta.env.BASE_URL}favicon.png`, window.location.origin).toString()

  setMetaTag('meta[name="description"]', { name: 'description', content: description })
  setMetaTag('meta[property="og:type"]', { property: 'og:type', content: 'website' })
  setMetaTag('meta[property="og:title"]', { property: 'og:title', content: title })
  setMetaTag('meta[property="og:description"]', { property: 'og:description', content: description })
  setMetaTag('meta[property="og:image"]', { property: 'og:image', content: imageUrl })
  setMetaTag('meta[property="og:url"]', { property: 'og:url', content: url })
  setMetaTag('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME })
  setMetaTag('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary' })
  setMetaTag('meta[name="twitter:title"]', { name: 'twitter:title', content: title })
  setMetaTag('meta[name="twitter:description"]', { name: 'twitter:description', content: description })
  setMetaTag('meta[name="twitter:image"]', { name: 'twitter:image', content: imageUrl })
  setLinkTag('canonical', url)
}
