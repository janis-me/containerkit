import { createContext, use, useContext, useEffect, useReducer, useRef } from 'react';

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
  const finalInstance = useRef(instance ? instance : new Containerkit());

  useEffect(() => {
    if (!finalInstance.current) return;

    if (!finalInstance.current.booted && !finalInstance.current.booting) {
      finalInstance.current.boot(name ?? 'default-project').then(() => {
        dispatch({ type: 'setContainerkitInstance', data: { instance: finalInstance.current } });
      });
    } else if (finalInstance.current.booted) {
      dispatch({ type: 'setContainerkitInstance', data: { instance: finalInstance.current } });
    }
  }, [name, instance]);

  const value = { state, dispatch };
  return <ContainerkitStateContext.Provider value={value}>{children}</ContainerkitStateContext.Provider>;
}

function useContainerkitContext() {
  const context = useContext(ContainerkitStateContext);
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
