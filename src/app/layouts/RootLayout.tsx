import { Outlet } from 'react-router';

export default function RootLayout() {
  return (
    <div id="app-root">
      <main>
        <Outlet />
      </main>
    </div>
  );
}
