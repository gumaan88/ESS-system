import React, { useState, useEffect } from 'react';
import { getServices } from '../services/firebaseService';
import { ServiceDefinition } from '../types';
import Spinner from '../components/Spinner';
import { Link } from 'react-router-dom';

const ServiceCard: React.FC<{ service: ServiceDefinition }> = ({ service }) => {
  return (
    <Link 
      to={`/request-form/${service.id}`}
      className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col items-center justify-center text-center border border-gray-100 dark:border-gray-700"
    >
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 bg-indigo-50 dark:bg-indigo-900/50`}>
            <span className="text-4xl">{service.icon}</span>
        </div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">{service.title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">اضغط لتقديم الطلب</p>
    </Link>
  );
};

const NewRequest: React.FC = () => {
    const [services, setServices] = useState<ServiceDefinition[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchServices = async () => {
            setLoading(true);
            try {
                // This now returns the hardcoded list directly
                const availableServices = await getServices();
                setServices(availableServices);
            } catch (error) {
                console.error("Error fetching services:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchServices();
    }, []);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">إنشاء طلب جديد</h1>
                <p className="mt-1 text-gray-500 dark:text-gray-400">اختر نوع الخدمة التي ترغب في طلبها.</p>
            </div>
            
            {loading ? (
                <div className="flex justify-center"><Spinner /></div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {services.map(service => (
                        <ServiceCard key={service.id} service={service} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default NewRequest;