module.exports = {
  title: 'gqless',
  tagline: `A GraphQL client without queries`,
  url: 'https://gqless.dev',
  baseUrl: '/',
  favicon: '/favicon.ico',
  organizationName: 'gqless',
  projectName: 'gqless',
  themeConfig: {
    sidebarCollapsible: true,
    prism: {
      theme: require('prism-react-renderer/themes/nightOwlLight'),
      darkTheme: require('prism-react-renderer/themes/shadesOfPurple'),
    },
    algolia: {
      apiKey: 'c00e78ccfa93ead531ad80e4dd94b48b',
      indexName: 'gqless',
      algoliaOptions: {},
    },
    googleAnalytics: {
      trackingID: 'UA-85426772-7',
    },
    navbar: {
      title: 'gqless',
      // logo: {
      //   alt: 'gqless Logo',
      //   src: 'img/logo.svg',
      // },
      items: [
        {
          label: 'Getting Started',
          to: 'introduction/getting-started',
          position: 'right',
          activeBasePath: 'introduction',
        },
        {
          label: 'React',
          to: 'react/basic-usage',
          position: 'right',
        },
        {
          label: 'FAQ',
          to: 'faq',
          position: 'right',
        },

        // { to: 'blog', label: 'Blog', position: 'left' },
        {
          href: 'https://github.com/gqless/gqless',
          position: 'right',
          dangerouslySetInnerHTML: {
            __html: `
              <img
                class="github-star"
                alt="GitHub"
                src="https://img.shields.io/github/stars/gqless/gqless?style=social&label=Star"
              />
            `,
          },
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              to: 'introduction/getting-started',
            },
            {
              label: 'React',
              to: 'react/basic-usage',
              position: 'right',
            },
            {
              label: 'FAQ',
              to: 'faq',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Twitter',
              href: 'http://twitter.com/gqlessdev',
            },
            {
              label: 'Spectrum',
              href: 'https://spectrum.chat/gqless',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/gqless/gqless',
            },
            {
              label: 'Open Collective',
              href: 'https://opencollective.com/gqless',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()}`,
    },
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          path: '../../docs',
          sidebarPath: require.resolve('./sidebars.js'),
          routeBasePath: '/',
          editUrl: 'https://github.com/gqless/gqless/edit/master/docs/',
          remarkPlugins: [require('./src/plugins/remark-yarn2npm')],
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
        },
        theme: {
          customCss: require.resolve('./src/style.css'),
        },
      },
    ],
  ],
  stylesheets: ['/fonts.css'],
};
