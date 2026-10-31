import { AtSign, Globe, Mail, Share2 } from 'lucide-react'
import { DoraraLogo } from '@/components/dorara-logo'

const columns = [
  {
    title: 'Product',
    links: ['AI Consultation', 'Global Dashboard', 'Compare', 'Saved Places', 'Pricing'],
  },
  {
    title: 'Categories',
    links: ['Travel', 'Healthcare', 'Education', 'Work', 'Business', 'Relocation'],
  },
  {
    title: 'Company',
    links: ['About', 'Careers', 'Blog', 'Contact'],
  },
  {
    title: 'Legal',
    links: ['Privacy', 'Terms', 'Cookies', 'Disclaimer'],
  },
]

const socials = [
  { icon: AtSign, label: 'Social' },
  { icon: Share2, label: 'Share' },
  { icon: Globe, label: 'Website' },
  { icon: Mail, label: 'Email' },
]

export function SiteFooter() {
  return (
    <footer className="bg-navy text-navy-foreground">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="max-w-xs">
            <DoraraLogo wordClassName="text-navy-foreground" showTagline />
            <p className="mt-4 text-sm leading-relaxed text-navy-foreground/60">
              Dorara helps you make major life decisions with AI reasoning,
              real-world data, and guidance that feels genuinely human.
            </p>
            <div className="mt-6 flex items-center gap-3">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href="#"
                  aria-label={social.label}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-navy-foreground/70 transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-semibold text-navy-foreground">
                {column.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-navy-foreground/60 transition-colors hover:text-primary"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-navy-foreground/50 sm:flex-row">
          <p>© {new Date().getFullYear()} Dorara. All rights reserved.</p>
          <p>Smart Decisions. Better Life.</p>
        </div>
      </div>
    </footer>
  )
}
