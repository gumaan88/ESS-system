
import React from 'react';

interface NotificationProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
  const baseClasses = 'fixed top-5 right-5 p-4 rounded-lg shadow-lg text-white text-sm z-50 flex items-center justify-between';
  const typeClasses = {
    success: 'bg-green-500',
    error: 'bg-red-500',
  };

  if (!message) return null;

  return (
    <div className={`${baseClasses} ${typeClasses[type]}`}>
      <span>{message}</span>
      <button onClick={onClose} className="ms-4 text-white hover:text-gray-200">
        &times;
      </button>
    </div>
  );
};

export default Notification;
