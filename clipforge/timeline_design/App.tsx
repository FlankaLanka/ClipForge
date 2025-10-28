import { Timeline } from './components/Timeline';

export default function App() {
  return (
    <div className="h-screen w-screen bg-white flex flex-col">
      <div className="flex-1 bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">
          Video Preview Area
        </div>
      </div>
      <Timeline />
    </div>
  );
}
