import cors from 'cors';
import config from '../config/env';

const corsOptions: cors.CorsOptions = {
    origin: function (origin, callback) {
        // Por ahora permitimos todo (Global)
        callback(null, true);
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

export default cors(corsOptions);
