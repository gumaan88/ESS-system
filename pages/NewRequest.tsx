import React, { useState, useEffect } from 'react';
import { getServices } from '../services/firebaseService';
import { ServiceDefinition } from '../types';
import Spinner from '../components/Spinner';
import { Link } from 'react-router-dom';

const ServiceCard: React.FC<{ service: ServiceDefinition }> = ({ service }) => {
  return (
    <Link 
      to={`/request-form/${service.id}`}
      className="group bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-sm hover:shadow-2xl hover:shadow-teal-100 dark:hover:shadow-none hover:-translate-y-2 transition-all duration-500 flex flex-col items-center justify-center text-center border border-gray-100 dark:border-gray-700 relative overflow-hidden"
    >
        <div className="absolute top-0 right-0 w-24 h-24 bg-teal-50 dark:bg-teal-900/20 rounded-bl-[4rem] -mr-8 -mt-8 transition-all group-hover:scale-150 duration-500"></div>
        
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6 bg-teal-50 dark:bg-teal-900/50 text-5xl group-hover:scale-110 transition-transform duration-500">
            {service.icon}
        </div>
        
        <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">{service.title}</h3>
        <p className="text-sm text-slate-400 mb-6">تقديم طلب رسمي عبر النظام الإلكتروني</p>
        
        <div className="w-12 h-12 rounded-full bg-teal-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0 shadow-lg shadow-teal-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
        </div>
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
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center max-w-2xl mx-auto">
                <h1 className="text-4xl font-black text-slate-800 dark:text-white mb-4">ماذا تود أن تطلب اليوم؟</h1>
                <p className="text-slate-500 dark:text-gray-400">اختر نوع الخدمة من القائمة أدناه، وسيتم توجيه طلبك آلياً إلى جهة الاختصاص بمؤسسة العون.</p>
            </div>
            
            {loading ? (
                <div className="flex justify-center py-24"><Spinner /></div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {services.map(service => (
                        <ServiceCard key={service.id} service={service} />
                    ))}
                    
                    {/* Placeholder for future services */}
                    <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 p-8 rounded-[2rem] flex flex-col items-center justify-center text-center opacity-50 grayscale">
                        <div className="text-4xl mb-4">🔜</div>
                        <h3 className="font-bold text-slate-400">خدمات إضافية قريباً</h3>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NewRequest;