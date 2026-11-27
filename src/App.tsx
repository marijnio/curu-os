import { useEffect } from 'react';
import { useOsStore } from './store/useOsStore';
import { Desktop } from './components/desktop/Desktop';

export default function App() {
  const initApp = useOsStore((s) => s.initApp);

  useEffect(() => {
    void initApp();
  }, [initApp]);

  return <Desktop />;
}
