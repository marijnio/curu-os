import { useEffect } from 'react';
import { useOsStore } from './store/useOsStore';
import { Desktop } from './components/desktop/Desktop';
import { LoginScreen } from './components/auth/LoginScreen';

export default function App() {
  const appPhase = useOsStore((s) => s.appPhase);
  const initApp = useOsStore((s) => s.initApp);

  useEffect(() => {
    void initApp();
  }, [initApp]);

  return appPhase === 'desktop' ? <Desktop /> : <LoginScreen />;
}
