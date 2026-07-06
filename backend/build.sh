#!/bin/bash
# Railway build script

echo "🔧 Installing Python dependencies..."
pip install --no-cache-dir -r requirements.txt

echo "📦 Verifying critical dependencies..."
python -c "import docx; print('✅ python-docx installed')" || echo "❌ python-docx FAILED"
python -c "import PyPDF2; print('✅ PyPDF2 installed')" || echo "❌ PyPDF2 FAILED"
python -c "import pptx; print('✅ python-pptx installed')" || echo "❌ python-pptx FAILED"

echo "✅ Build complete!"
