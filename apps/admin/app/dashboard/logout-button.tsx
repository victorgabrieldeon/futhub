'use client';

export function LogoutButton() {
  return (
    <button
      className="logout-button"
      onClick={async () => {
        await fetch('/api/session', { method: 'DELETE' });
        window.location.assign('/login');
      }}
      type="button"
    >
      Sair
    </button>
  );
}
