"""
Plantillas HTML animadas para emails de reactivación de usuarios
"""
from datetime import datetime

def get_motivation_email_template(user_name: str, days_absent: int) -> str:
    """
    Plantilla de email motivacional para usuarios ausentes por 1-2 días.
    Incluye animación de cerebro animado.
    """
    return f"""
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>¡Te extrañamos en Scolyax!</title>
    <style>
        @keyframes bounce {{
            0%, 100% {{ transform: translateY(0); }}
            50% {{ transform: translateY(-20px); }}
        }}
        
        @keyframes wave {{
            0%, 100% {{ transform: rotate(0deg); }}
            25% {{ transform: rotate(15deg); }}
            75% {{ transform: rotate(-15deg); }}
        }}
        
        @keyframes pulse {{
            0%, 100% {{ transform: scale(1); }}
            50% {{ transform: scale(1.1); }}
        }}
        
        @keyframes shine {{
            0% {{ opacity: 0.3; }}
            50% {{ opacity: 1; }}
            100% {{ opacity: 0.3; }}
        }}
        
        body {{
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }}
        
        .container {{
            max-width: 600px;
            margin: 40px auto;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }}
        
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            text-align: center;
            position: relative;
        }}
        
        .brain-container {{
            width: 120px;
            height: 120px;
            margin: 0 auto 20px;
            animation: bounce 2s ease-in-out infinite;
        }}
        
        .brain {{
            width: 100%;
            height: 100%;
            animation: pulse 1.5s ease-in-out infinite;
        }}
        
        .sparkle {{
            position: absolute;
            width: 30px;
            height: 30px;
            animation: shine 2s ease-in-out infinite;
        }}
        
        .sparkle1 {{ top: 20px; left: 20px; animation-delay: 0s; }}
        .sparkle2 {{ top: 20px; right: 20px; animation-delay: 0.5s; }}
        .sparkle3 {{ bottom: 20px; left: 40px; animation-delay: 1s; }}
        .sparkle4 {{ bottom: 20px; right: 40px; animation-delay: 1.5s; }}
        
        h1 {{
            color: white;
            margin: 0;
            font-size: 28px;
            font-weight: bold;
        }}
        
        .content {{
            padding: 40px 30px;
            text-align: center;
        }}
        
        .message {{
            font-size: 18px;
            color: #333;
            line-height: 1.6;
            margin-bottom: 30px;
        }}
        
        .highlight {{
            color: #667eea;
            font-weight: bold;
        }}
        
        .streak-info {{
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 20px;
            border-radius: 15px;
            margin: 20px 0;
            font-size: 16px;
        }}
        
        .cta-button {{
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 40px;
            text-decoration: none;
            border-radius: 50px;
            font-size: 18px;
            font-weight: bold;
            margin: 20px 0;
            transition: transform 0.3s ease;
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
        }}
        
        .cta-button:hover {{
            transform: translateY(-3px);
            box-shadow: 0 15px 40px rgba(102, 126, 234, 0.6);
        }}
        
        .footer {{
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }}
        
        .emoji {{
            font-size: 24px;
            display: inline-block;
            animation: wave 1s ease-in-out infinite;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="sparkle sparkle1">⭐</div>
            <div class="sparkle sparkle2">✨</div>
            <div class="sparkle sparkle3">💫</div>
            <div class="sparkle sparkle4">🌟</div>
            
            <div class="brain-container">
                <svg class="brain" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="brainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:#ffd700;stop-opacity:1" />
                            <stop offset="100%" style="stop-color:#ff6b6b;stop-opacity:1" />
                        </linearGradient>
                    </defs>
                    <!-- Brain shape -->
                    <path d="M50 20 C 30 20, 20 30, 20 45 C 20 55, 25 60, 30 65 C 25 70, 20 75, 25 85 C 30 90, 40 90, 50 85 C 60 90, 70 90, 75 85 C 80 75, 75 70, 70 65 C 75 60, 80 55, 80 45 C 80 30, 70 20, 50 20 Z" 
                          fill="url(#brainGrad)" stroke="white" stroke-width="2"/>
                    <!-- Brain details -->
                    <path d="M 35 35 Q 40 40, 35 45" fill="none" stroke="white" stroke-width="2" opacity="0.8"/>
                    <path d="M 50 30 Q 55 35, 50 40" fill="none" stroke="white" stroke-width="2" opacity="0.8"/>
                    <path d="M 65 35 Q 60 40, 65 45" fill="none" stroke="white" stroke-width="2" opacity="0.8"/>
                    <!-- Smiley face -->
                    <circle cx="40" cy="50" r="3" fill="white"/>
                    <circle cx="60" cy="50" r="3" fill="white"/>
                    <path d="M 35 60 Q 50 70, 65 60" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"/>
                </svg>
            </div>
            
            <h1>¡Hola {user_name}! <span class="emoji">👋</span></h1>
        </div>
        
        <div class="content">
            <div class="message">
                <p style="font-size: 20px; margin-bottom: 15px;">
                    Te hemos extrañado estos últimos <span class="highlight">{days_absent} día{"s" if days_absent > 1 else ""}</span> 🔥
                </p>
                <p>
                    Tu racha de productividad te está esperando. Cada día cuenta, y sabemos que tienes metas increíbles por alcanzar.
                </p>
            </div>
            
            <div class="streak-info">
                <strong>⚡ ¡No pierdas tu momentum!</strong><br>
                Vuelve hoy y continúa construyendo tus hábitos ganadores.
            </div>
            
            <a href="{get_app_url()}" class="cta-button">
                🚀 Volver a Scolyax
            </a>
            
            <p style="color: #666; margin-top: 30px;">
                Recuerda: La consistencia es más poderosa que la perfección. <br>
                <strong>¡Estamos aquí para apoyarte! 💪</strong>
            </p>
        </div>
        
        <div class="footer">
            <p>Este es un recordatorio automático de Scolyax</p>
            <p>© {datetime.now().year} Scolyax - Tu asistente de productividad personal</p>
        </div>
    </div>
</body>
</html>
"""

def get_sad_email_template(user_name: str, days_absent: int) -> str:
    """
    Plantilla de email triste para usuarios ausentes por 3+ días.
    Incluye animación de cerebro triste.
    """
    return f"""
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>¿Volverás pronto?</title>
    <style>
        @keyframes sadFloat {{
            0%, 100% {{ transform: translateY(0) rotate(-2deg); }}
            50% {{ transform: translateY(10px) rotate(2deg); }}
        }}
        
        @keyframes tear {{
            0% {{ transform: translateY(0); opacity: 0; }}
            50% {{ opacity: 1; }}
            100% {{ transform: translateY(20px); opacity: 0; }}
        }}
        
        @keyframes fadeIn {{
            0% {{ opacity: 0; transform: translateY(20px); }}
            100% {{ opacity: 1; transform: translateY(0); }}
        }}
        
        body {{
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
        }}
        
        .container {{
            max-width: 600px;
            margin: 40px auto;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        }}
        
        .header {{
            background: linear-gradient(135deg, #8e9eab 0%, #cbd5e0 100%);
            padding: 40px 20px;
            text-align: center;
            position: relative;
        }}
        
        .brain-container {{
            width: 120px;
            height: 140px;
            margin: 0 auto 20px;
            position: relative;
            animation: sadFloat 3s ease-in-out infinite;
        }}
        
        .tear {{
            position: absolute;
            font-size: 20px;
            animation: tear 2s ease-in-out infinite;
        }}
        
        .tear1 {{ left: 35px; top: 65px; animation-delay: 0s; }}
        .tear2 {{ right: 35px; top: 65px; animation-delay: 1s; }}
        
        .cloud {{
            position: absolute;
            color: #ccc;
            font-size: 40px;
            opacity: 0.5;
        }}
        
        .cloud1 {{ top: 10px; left: 10px; }}
        .cloud2 {{ top: 30px; right: 10px; }}
        
        h1 {{
            color: #4a5568;
            margin: 0;
            font-size: 26px;
            font-weight: bold;
        }}
        
        .content {{
            padding: 40px 30px;
            text-align: center;
            animation: fadeIn 1s ease-out;
        }}
        
        .message {{
            font-size: 18px;
            color: #4a5568;
            line-height: 1.8;
            margin-bottom: 30px;
        }}
        
        .stats {{
            background: #f7fafc;
            border-left: 4px solid #cbd5e0;
            padding: 20px;
            margin: 20px 0;
            text-align: left;
        }}
        
        .stats-item {{
            margin: 10px 0;
            color: #718096;
            font-size: 16px;
        }}
        
        .stats-number {{
            color: #667eea;
            font-weight: bold;
            font-size: 24px;
        }}
        
        .cta-button {{
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 40px;
            text-decoration: none;
            border-radius: 50px;
            font-size: 18px;
            font-weight: bold;
            margin: 20px 0;
            transition: all 0.3s ease;
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
        }}
        
        .cta-button:hover {{
            transform: translateY(-3px);
            box-shadow: 0 15px 40px rgba(102, 126, 234, 0.5);
        }}
        
        .quote {{
            font-style: italic;
            color: #718096;
            margin: 30px 0;
            padding: 20px;
            background: #f7fafc;
            border-radius: 10px;
        }}
        
        .footer {{
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="cloud cloud1">☁️</div>
            <div class="cloud cloud2">☁️</div>
            
            <div class="brain-container">
                <svg width="120" height="120" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="sadBrainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:#a8b8d8;stop-opacity:1" />
                            <stop offset="100%" style="stop-color:#7f8fa6;stop-opacity:1" />
                        </linearGradient>
                    </defs>
                    <!-- Sad brain shape -->
                    <path d="M50 20 C 30 20, 20 30, 20 45 C 20 55, 25 60, 30 65 C 25 70, 20 75, 25 85 C 30 90, 40 90, 50 85 C 60 90, 70 90, 75 85 C 80 75, 75 70, 70 65 C 75 60, 80 55, 80 45 C 80 30, 70 20, 50 20 Z" 
                          fill="url(#sadBrainGrad)" stroke="#718096" stroke-width="2"/>
                    <!-- Sad eyes -->
                    <circle cx="38" cy="50" r="3" fill="#4a5568"/>
                    <circle cx="62" cy="50" r="3" fill="#4a5568"/>
                    <!-- Sad mouth -->
                    <path d="M 35 65 Q 50 55, 65 65" fill="none" stroke="#4a5568" stroke-width="3" stroke-linecap="round"/>
                    <!-- Eyebrows -->
                    <path d="M 32 43 L 44 45" stroke="#4a5568" stroke-width="2" stroke-linecap="round"/>
                    <path d="M 56 45 L 68 43" stroke="#4a5568" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <div class="tear tear1">💧</div>
                <div class="tear tear2">💧</div>
            </div>
            
            <h1>Hace {days_absent} días que no te vemos, {user_name} 😢</h1>
        </div>
        
        <div class="content">
            <div class="message">
                <p style="font-size: 20px; margin-bottom: 15px;">
                    <strong>¿Qué pasó? ¿Por qué no has vuelto?</strong>
                </p>
                <p>
                    Extrañamos verte alcanzar tus metas. Han pasado <strong>{days_absent} días</strong> desde tu última visita, 
                    y nos preguntamos si todo está bien.
                </p>
            </div>
            
            <div class="stats">
                <div class="stats-item">
                    📅 Días desde tu última visita: <span class="stats-number">{days_absent}</span>
                </div>
                <div class="stats-item">
                    💔 Racha perdida, pero puedes recuperarla
                </div>
                <div class="stats-item">
                    ⏰ Tu potencial está esperando
                </div>
            </div>
            
            <div class="quote">
                "El éxito no es final, el fracaso no es fatal: lo que cuenta es el coraje para continuar."
                <br><strong>— Winston Churchill</strong>
            </div>
            
            <p style="color: #4a5568; font-size: 17px;">
                Sabemos que la vida puede ser complicada, pero incluso 5 minutos al día pueden marcar la diferencia. 
                <br><br>
                <strong>¿Nos das otra oportunidad? 🙏</strong>
            </p>
            
            <a href="{get_app_url()}" class="cta-button">
                💙 Volver y Empezar de Nuevo
            </a>
            
            <p style="color: #999; margin-top: 30px; font-size: 15px;">
                Siempre estaremos aquí para apoyarte en tu camino hacia el éxito.
            </p>
        </div>
        
        <div class="footer">
            <p>Este es un recordatorio amistoso de Scolyax</p>
            <p>Estamos aquí cuando estés listo para volver 💜</p>
            <p>© {datetime.now().year} Scolyax - Tu asistente de productividad personal</p>
        </div>
    </div>
</body>
</html>
"""

def get_app_url() -> str:
    """Obtiene la URL de la aplicación desde las variables de entorno"""
    import os
    return os.getenv("SCOLYAX_FRONTEND_URL", "https://scolyax.vercel.app")
