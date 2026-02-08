
import React, { useState, useEffect } from 'react';
import { getServices } from '../services/firebaseService';
import { ServiceDefinition } from '../types';
import Spinner from '../components/Spinner';
import { Link } from 'react-router-dom';

const ServiceCard: React.FC<{ service: ServiceDefinition }> = ({ service }) => {
  return (
    <Link 
      to={`/request-form/${service.id}`}
      className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col items-center justify-center text-center"
    >
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-indigo-100 dark:bg-indigo-900`}>
            <span className="text-3xl">{service.icon}</span>
        </div>
        <h3 className="text-lg font-bold text-gray-800 dark:text-white">{service.title}</h3>
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
            ) : services.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {services.map(service => (
                        <ServiceCard key={service.id} service={service} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-xl">
                    <p className="text-gray-500 dark:text-gray-400">لا توجد خدمات متاحة حالياً.</p>
                </div>
            )}
        </div>
    );
};

export default NewRequest;
