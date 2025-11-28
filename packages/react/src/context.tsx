import { createContext, useContext, useEffect, useReducer, useRef } from 'react';

import Containerkit from '@containerkit/core';

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
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
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    case 'setContainerkitInstance': {
      return { ...state, containerkitInstance: action.data.instance };
    }
    default: {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`Unhandled action type: ${action.type}`);
    }
  }
}

function ContainerkitProvider({ children, instance, name }: ContainerkitProviderProps) {
  const [state, dispatch] = useReducer(containerkitReducer, DEFAULT_STATE);
  const finalInstance = useRef(instance ?? new Containerkit());

  useEffect(() => {
    if (!finalInstance.current.booted && !finalInstance.current.booting) {
      finalInstance.current
        .boot(name ?? 'default-project')
        .then(() => {
          dispatch({ type: 'setContainerkitInstance', data: { instance: finalInstance.current } });
        })
        .catch((err: unknown) => {
          console.error('Failed to boot Containerkit instance:', err);
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
