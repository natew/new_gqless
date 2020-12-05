import React from 'react';

type Visitor = (
  element: React.ElementType<any>,
  instance?: React.Component<any, any>
) => void | Promise<any>;

function ssrPrepass(node: React.ReactNode, visitor?: Visitor): Promise<void>;

export = ssrPrepass;
