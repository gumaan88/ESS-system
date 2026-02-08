
import React from 'react';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => {
  return (
    <div className="text-center">
      <h1 className="text-6xl font-bold text-gray-800 dark:text-white">404</h1>
      <p className="text-xl mt-4 text-gray-600 dark:text-gray-300">الصفحة غير موجودة</p>
      <p className="mt-2 text-gray-500 dark:text-gray-400">عذراً، لم نتمكن من العثور على الصفحة التي تبحث عنها.</p>
      <Link to="/dashboard" className="mt-6 inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg shadow hover:bg-indigo-700">
        العودة إلى لوحة التحكم
      </Link>
    </div>
  );
};

export default NotFound;
