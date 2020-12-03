import { useEffect } from 'react';
import { useIsomorphicLayoutEffect } from '../components/common';

const C = () => {
  setTimeout(() => {
    console.log('timeout 0 C');
  }, 0);
  useIsomorphicLayoutEffect(() => {
    console.log('layout effect C');
  }, []);
  useEffect(() => {
    console.log('useEffect C');
  }, []);
  const c = <div>C</div>;

  console.log('render C');

  return c;
};

const B = () => {
  setTimeout(() => {
    console.log('timeout 0 B');
  }, 0);
  useIsomorphicLayoutEffect(() => {
    console.log('layout effect B');
  }, []);
  useEffect(() => {
    console.log('useEffect B');
  }, []);
  const b = (
    <>
      <div>B</div>
      <C />
    </>
  );

  console.log('render B');

  return b;
};

const A = () => {
  setTimeout(() => {
    console.log('timeout 0 A');
  }, 0);
  useIsomorphicLayoutEffect(() => {
    console.log('layout effect A');
  }, []);
  useEffect(() => {
    console.log('useEffect A');
  }, []);
  const a = (
    <>
      <div>A</div>
      <B />
    </>
  );
  console.log('render A');

  return a;
};

export default A;
