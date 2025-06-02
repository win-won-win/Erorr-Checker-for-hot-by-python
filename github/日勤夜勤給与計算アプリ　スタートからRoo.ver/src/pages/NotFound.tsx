import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 px-4">
      <h1 className="text-6xl font-bold text-gray-800 mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-gray-600 mb-8">ページが見つかりません</h2>
      <p className="text-gray-500 mb-8 text-center max-w-md">
        お探しのページは存在しないか、移動または削除された可能性があります。
      </p>
      <Link
        to="/attendance/new"
        className="px-6 py-3 bg-blue-600 text-white font-medium rounded hover:bg-blue-700"
      >
        ホームに戻る
      </Link>
    </div>
  );
};

export default NotFound;