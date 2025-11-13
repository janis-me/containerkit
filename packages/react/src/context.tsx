import * as React from 'react';
import { createContext, useEffect, useReducer } from 'react';

import Containerkit from '@containerkit/core';

type Action = {
  type: 'setContainerkitInstance';
  data: { instance: Containerkit };
};

type Dispatch = (action: Action) => void;
interface ContainerkitProviderProps {
  children: React.ReactNode;
  name?: string | undefined;
  instance?: Containerkit | undefined;
}

interface State {
  containerkitInstance: Containerkit | undefined;
}

const DEFAULT_STATE = {
  containerkitInstance: undefined,
} satisfies State;

const ContainerkitStateContext = createContext<{ state: State; dispatch: Dispatch } | undefined>(undefined);

function containerkitReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setContainerkitInstance': {
      return { ...state, containerkitInstance: action.data.instance };
    }
    default: {
      throw new Error(`Unhandled action type: ${(action as { type: unknown }).type}`);
    }
  }
}

function ContainerkitProvider({ children, instance, name }: ContainerkitProviderProps) {
  const [state, dispatch] = useReducer(containerkitReducer, DEFAULT_STATE);

  useEffect(() => {
    if (instance) {
      dispatch({ type: 'setContainerkitInstance', data: { instance } });
    } else if (name) {
      const instance = new Containerkit();
      instance
        .init(name)
        .then(() => {
          dispatch({ type: 'setContainerkitInstance', data: { instance } });
        })
        .catch((error: unknown) => {
          console.error('Failed to initialize Containerkit instance:', error);
        });
    } else {
      throw new Error('Either instance or name must be provided to ContainerkitProvider');
    }
  }, [instance, name]);

  const value = { state, dispatch };
  return <ContainerkitStateContext.Provider value={value}>{children}</ContainerkitStateContext.Provider>;
}

function useContainerkitContext() {
  const context = React.useContext(ContainerkitStateContext);
  if (context === undefined) {
    throw new Error('useContainerkit must be used within a ContainerkitProvider');
  }
  return context;
}

function useContainerkit() {
  const { state } = useContainerkitContext();
  return state.containerkitInstance;
}

export { ContainerkitProvider, useContainerkitContext, useContainerkit };
