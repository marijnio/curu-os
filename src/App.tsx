import { useEffect } from 'react';
import { useOsStore } from './store/useOsStore';
import { Desktop } from './components/desktop/Desktop';
import { LoginScreen } from './components/auth/LoginScreen';
import { ScenarioSetupScreen } from './components/auth/ScenarioSetupScreen';
import { StartScreen } from './components/auth/StartScreen';

export default function App() {
  const appPhase = useOsStore((s) => s.appPhase);
  const initApp = useOsStore((s) => s.initApp);

  useEffect(() => {
    void initApp();
  }, [initApp]);

  if (appPhase === 'desktop') return <Desktop />;
  if (appPhase === 'start') return <StartScreen />;
  if (appPhase === 'scenario_setup') return <ScenarioSetupScreen />;
  return <LoginScreen />;
}
