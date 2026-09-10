import { useEffect, useRef, useState } from 'react';
import './login-stadium.css';

export function LoginScene() {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let active = true;
    let dispose: (() => void) | undefined;
    void import('./stadium-model')
      .then(({ mountStadium }) => {
        if (active) dispose = mountStadium(element, setStatus);
      })
      .catch(() => {
        if (active) setStatus('fallback');
      });
    return () => {
      active = false;
      dispose?.();
    };
  }, []);

  return (
    <div className="login-stadium" ref={host} aria-hidden="true" data-render-status={status}>
      <div className="login-stadium__fallback">
        <div className="login-stadium__field">
          <i />
          <b />
        </div>
      </div>
    </div>
  );
}
