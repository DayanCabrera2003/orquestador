import { ReactFlowProvider } from '@xyflow/react';
import { useEffect } from 'react';
import { engineSocket } from './api/socket';
import { Toasts } from './components/Toasts';
import { Canvas } from './features/canvas/Canvas';
import { EnvironmentBanner } from './features/environment/EnvironmentBanner';
import { InboxModal } from './features/inbox/InboxModal';
import { NewSessionModal } from './features/new-session/NewSessionModal';
import { ProjectsScreen } from './features/projects/ProjectsScreen';
import { SessionPanel } from './features/session-panel/SessionPanel';
import { TopBar } from './features/topbar/TopBar';
import { t } from './i18n/t';
import styles from './App.module.css';
import { useApp } from './stores/appStore';
import { useFlow } from './stores/flowStore';
import { useRuntime } from './stores/runtimeStore';
import { useUi } from './stores/uiStore';

function Workspace() {
  return (
    <ReactFlowProvider>
      <TopBar />
      <div className={styles.main}>
        <Canvas />
        <SessionPanel />
      </div>
      <NewSessionModal />
      <InboxModal />
    </ReactFlowProvider>
  );
}

export function App() {
  const ready = useApp((s) => s.ready);
  const init = useApp((s) => s.init);
  const setConnected = useApp((s) => s.setConnected);
  const flowId = useApp((s) => s.flowId);
  const flow = useFlow((s) => s.flow);

  useEffect(() => {
    void init();
    const offEvent = engineSocket.onEvent((e) => {
      useRuntime.getState().handle(e);
    });
    const offStatus = engineSocket.onStatus(setConnected);
    engineSocket.connect();
    return () => {
      offEvent();
      offStatus();
      engineSocket.close();
    };
  }, [init, setConnected]);

  useEffect(() => {
    useUi.getState().select(null);
    useRuntime.getState().reset();
    if (!flowId) {
      useFlow.getState().clear();
      return;
    }
    void useFlow.getState().load(flowId);
    void useRuntime.getState().loadFlow(flowId);
  }, [flowId]);

  return (
    <div className={styles.app}>
      <EnvironmentBanner />
      {!ready ? (
        <div className={styles.loading}>{t('app.loading')}</div>
      ) : flowId && flow ? (
        <Workspace />
      ) : (
        <ProjectsScreen />
      )}
      <Toasts />
    </div>
  );
}
