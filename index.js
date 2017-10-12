const string = require('string')

const slugify = s =>
  string(s).slugify().toString()

const position = {
  false: 'push',
  true: 'unshift'
}

const hasProp = ({}).hasOwnProperty

const permalinkHref = slug => `#${slug}`

const renderPermalink = (slug, opts, state, idx) => {
  const space = () =>
    Object.assign(new state.Token('text', '', 0), { content: ' ' })

  const linkTokens = [
    Object.assign(new state.Token('link_open', 'a', 1), {
      attrs: [
        ['class', opts.permalinkClass],
        ['href', opts.permalinkHref(slug, state)],
        ['aria-hidden', 'true']
      ]
    }),
    Object.assign(new state.Token('html_block', '', 0), { content: opts.permalinkSymbol }),
    new state.Token('link_close', 'a', -1)
  ]

  // `push` or `unshift` according to position option.
  // Space is at the opposite side.
  linkTokens[position[!opts.permalinkBefore]](space())
  state.tokens[idx + 1].children[position[opts.permalinkBefore]](...linkTokens)
}

const uniqueSlug = (slug, slugs) => {
  // Mark this slug as used in the environment.
  slugs[slug] = (hasProp.call(slugs, slug) ? slugs[slug] : 0) + 1

  // First slug, return as is.
  if (slugs[slug] === 1) {
    return slug
  }

  // Duplicate slug, add a `-2`, `-3`, etc. to keep ID unique.
  return slug + '-' + slugs[slug]
}

const uniqueNestedSlug = (slug, slugs, currentLevel) => {
  // Mark this slug as used in the environment.
  slugs[currentLevel - 1][slug] = (hasProp.call(slugs[currentLevel - 1], slug) ? slugs[currentLevel - 1][slug] : 0) + 1

  // First slug, return as is.
  if (slugs[currentLevel - 1][slug] === 1) {
    return slug
  }

  // Duplicate slug, add a `-2`, `-3`, etc. to keep ID unique.
  return slug + '-' + slugs[currentLevel - 1][slug]
}

const isLevelSelectedNumber = selection => level => level >= selection
const isLevelSelectedArray = selection => level => selection.includes(level)

const buildSlug = (slugHistory) => {
  // console.log(slugHistory)

  var results = ''
  for (let i = 0; i < slugHistory.length; i++) {
    if (i === 0) {
      results += slugHistory[i].slug
    } else {
      results += '-' + slugHistory[i].slug
    }
  }

  return results
}

const anchor = (md, opts) => {
  opts = Object.assign({}, anchor.defaults, opts)

  md.core.ruler.push('anchor', state => {
    const nestedSlugs = [{}, {}, {}, {}, {}, {}]
    const slugs = {}
    const tokens = state.tokens
    let previousLevel = 0
    let currentLevel = 0
    let slugHistory = []

    const isLevelSelected = Array.isArray(opts.level)
      ? isLevelSelectedArray(opts.level)
      : isLevelSelectedNumber(opts.level)

    tokens
      .filter(token => token.type === 'heading_open')
      .filter(token => isLevelSelected(Number(token.tag.substr(1))))
      .forEach(token => {
        currentLevel = Number(token.tag.substr(1))

        // Aggregate the next token children text.
        const title = tokens[tokens.indexOf(token) + 1].children
          .filter(token => token.type === 'text' || token.type === 'code_inline')
          .reduce((acc, t) => acc + t.content, '')

        let slugString = opts.slugify(title)
        let slug = token.attrGet('id')

        if (slug == null) {
          // console.log(currentLevel, previousLevel)

          if (opts.nestSlugs) {
            if (currentLevel === 1) {
              // console.log('reset')
              previousLevel = 0
            }

            if (currentLevel === previousLevel) {
              // console.log('sibling')
              slugHistory[slugHistory.length - 1] = {slug: slugString}
              slug = buildSlug(slugHistory)
              // console.log(slug)
            }

            if (previousLevel === 0) {
              // console.log('reset part 2')
              previousLevel = currentLevel
              slugHistory = [{slug: slugString}]
              slug = buildSlug(slugHistory)
              // console.log(slug)
            }

            if (previousLevel > 0 && currentLevel > previousLevel) {
              // console.log('child')
              previousLevel = currentLevel
              slugHistory.push({slug: slugString})
              slug = buildSlug(slugHistory)
              // console.log(slug)
            }

            if (previousLevel > 0 && currentLevel < previousLevel) {
              // console.log('uncle')
              previousLevel = currentLevel
              slugHistory = slugHistory.slice(0, currentLevel - 1)
              slugHistory.push({slug: slugString})
              slug = buildSlug(slugHistory)
              // console.log(slug)
            }
          }

          // console.log(slugHistory)

          if (opts.nestSlugs) {
            let originalSlug = slug

            slug = uniqueNestedSlug(originalSlug, nestedSlugs, currentLevel)

            if (slug !== originalSlug) {
              slugHistory[slugHistory.length - 1] = {slug: slug}
            }
          } else {
            slug = uniqueSlug(slugString, slugs)
          }

          // console.log(slug)
          // console.log(' ')
          token.attrPush(['id', slug])
        }

        if (opts.permalink) {
          opts.renderPermalink(slug, opts, state, tokens.indexOf(token))
        }

        if (opts.callback) {
          opts.callback(token, { slug, title })
        }
      })
  })
}

anchor.defaults = {
  level: 1,
  slugify,
  permalink: false,
  renderPermalink,
  permalinkClass: 'header-anchor',
  permalinkSymbol: '¶',
  permalinkBefore: false,
  permalinkHref,
  nestSlugs: false
}

module.exports = anchor
