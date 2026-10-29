import { NotFound } from '../src/components/NotFound';

// Any unknown link, including the removed /dev/checks route, ends here; nothing is read or written.
export default function NotFoundRoute() {
  return <NotFound />;
}
