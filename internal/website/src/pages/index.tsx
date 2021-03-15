import 'regenerator-runtime/runtime';

import { motion, useAnimation } from 'framer-motion';
import * as React from 'react';

import isInternalUrl from '@docusaurus/isInternalUrl';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styled from '@emotion/styled';
import CodeBlock from '@theme/CodeBlock';
import Layout from '@theme/Layout';

import { Arrow, Example, Feature, Overflow } from '../components';

const Glare = styled.div`
  background: radial-gradient(rgba(69, 72, 75, 0.15), rgba(69, 72, 75, 0.25));
`;

const Features = styled(motion.section)`
  display: grid;
  overflow: hidden;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  padding: 1.5rem 0;
`;

Features.defaultProps = {
  className: 'container',
};

const ResultArrow = styled(Arrow)`
  color: rgb(235, 185, 44);
  height: 3rem;
  align-self: center;
  margin-left: 3.5rem;
  margin-right: 3rem;
`;

const FeatureLink = styled(Link)`
  color: inherit !important;
  text-decoration: none !important;
`;

const Header = styled(motion.div)`
  color: #fff;
  flex-direction: column;
  background: linear-gradient(rgb(0, 5, 40), rgb(28, 42, 139));

  .hero__title {
    background: linear-gradient(rgb(255, 87, 241), rgb(75, 0, 255));
    text-transform: uppercase;
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: rgba(0, 0, 0, 0);
    font-weight: 600;
    font-size: 64px;
  }
`;

const Hero = styled(motion.div)`
  margin-bottom: 4rem;
  text-align: center;
`;

const Examples = styled(motion.div)`
  display: flex;
`;

const yourApp = `const App = () => (
  <div>
    {query.me.name}
    {query.users({ limit: 10 }).map(user => (
      <div key={user.id}>{user.name}</div>
    ))}
  </div>
)`;

const generatedQuery = `query App {
  me { name }
  users(limit: 10) {
    id
    name
  }
}`;

const Actions = styled(motion.div)`
  display: flex;
  justify-content: center;
`;

const Action = styled(Link)`
  font-size: 1.6rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 0 0.7rem;
`;

const delay = (t) => new Promise((resolve) => setTimeout(resolve, t));

export default () => {
  const context = useDocusaurusContext();

  const { siteConfig = {} } = context;

  const info = useAnimation();
  const app = useAnimation();
  const queries = useAnimation();
  const arrow = useAnimation();
  const features = useAnimation();

  React.useEffect(() => {
    (async () => {
      await delay(200);

      await info.start('visible');

      app.start('visible');
      await delay(500);

      arrow.start('visible');
      await delay(1200);
      await queries.start('visible');
      await features.start('visible');
    })();
  }, []);

  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <Header className="hero">
        <Hero
          initial="hidden"
          animate={info}
          variants={{
            visible: {
              transition: {
                staggerChildren: 0.1,
              },
            },
          }}
        >
          <Overflow>
            <motion.h1
              className="hero__title"
              variants={{
                hidden: { translateY: '130%' },
                visible: { translateY: '0%' },
              }}
            >
              {siteConfig.title}
            </motion.h1>
          </Overflow>
          <Overflow>
            <motion.p
              className="hero__subtitle"
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1 },
              }}
            >
              A GraphQL client, for rapid iteration.
            </motion.p>
          </Overflow>
          <Actions
            variants={{
              hidden: { opacity: 0, scale: 1.3 },
              visible: { opacity: 1, scale: 1 },
            }}
          >
            <Action to="/introduction/getting-started">Get Started ›</Action>
            <Action
              to="/introduction/getting-started"
              style={{ color: 'rgb(170, 170, 255)' }}
            >
              Explore features ›
            </Action>
          </Actions>
        </Hero>
        <Examples>
          <Example title="Access GraphQL data" animate={app}>
            <CodeBlock className="language-jsx">{yourApp}</CodeBlock>
          </Example>
          <ResultArrow animate={arrow} />
          <Example title="Fetched automagically" animate={queries}>
            <CodeBlock className="language-graphql">{generatedQuery}</CodeBlock>
          </Example>
        </Examples>
      </Header>
      <main>
        <Glare>
          <Features
            initial="hidden"
            animate={features}
            variants={{
              visible: {
                transition: {
                  staggerChildren: 0.08,
                },
              },
            }}
          >
            <FeatureLink to="/introduction/features#invisible-data-fetching">
              <Feature
                title="Invisible data fetching"
                imageUrl="img/graphql.svg"
              >
                Queries are generated at runtime, by using JS getters.
              </Feature>
            </FeatureLink>
            <FeatureLink to="/introduction/features#typescript">
              <Feature title="Strongly typed" imageUrl="img/typescript.png">
                Built from the ground up to work with Typescript — no more code
                generation
              </Feature>
            </FeatureLink>
            <FeatureLink to="react/basic-usage">
              <Feature title="React.js" imageUrl="img/react.svg">
                React Suspense, hooks, automatic component updates and more.
              </Feature>
            </FeatureLink>
            <FeatureLink to="/introduction/features">
              <Feature
                title="Production ready"
                imageUrl="img/production_ready.png"
              >
                Fully-featured with inbuilt cache, extensions and more.
              </Feature>
            </FeatureLink>
          </Features>
        </Glare>
      </main>
    </Layout>
  );
};
