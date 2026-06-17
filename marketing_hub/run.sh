#!/bin/bash
# EduExpress Marketing Hub Runner
# Easy execution script for all Marketing Hub functions

HUB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HUB_DIR"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     EduExpress Marketing Hub - Social Media Engineer        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.8+"
    exit 1
fi

# Check dependencies
if ! python3 -c "import requests" 2>/dev/null; then
    echo "📦 Installing dependencies..."
    pip3 install -r requirements.txt
fi

# Menu
case "${1:-menu}" in
    full|full_pipeline|pipeline)
        echo "🚀 Running FULL PIPELINE..."
        MONTH=${2:-$(date +%m)}
        YEAR=${3:-$(date +%Y)}
        THEME="${4:-Monthly Scholarship Campaign}"
        python3 main.py --command full_pipeline --month "$MONTH" --year "$YEAR" --theme "$THEME"
        ;;
    
    calendar|cal)
        echo "📅 Generating Content Calendar..."
        MONTH=${2:-$(date +%m)}
        YEAR=${3:-$(date +%Y)}
        THEME="${4:-Monthly Campaign}"
        python3 main.py --command calendar --month "$MONTH" --year "$YEAR" --theme "$THEME"
        ;;
    
    content|tiktok|video)
        echo "🎬 Generating Content..."
        TOPIC="${2:-CSCA Free Admission}"
        python3 main.py --command content --topic "$TOPIC"
        ;;
    
    campaign|ad|ads)
        echo "📢 Generating Ad Campaign..."
        CAMPAIGN="${2:-csca_free}"
        python3 main.py --command campaign --campaign "$CAMPAIGN"
        ;;
    
    report|weekly)
        echo "📊 Generating Weekly Report..."
        python3 main.py --command report
        ;;
    
    scale|scaling|grow)
        echo "📈 Generating Scaling Recommendations..."
        python3 main.py --command scale
        ;;
    
    test|demo)
        echo "🧪 Running DEMO mode..."
        echo ""
        echo "1. Generating TikTok script about 'Payment After Visa'..."
        python3 -c "
from main import MarketingHub
hub = MarketingHub()
result = hub.generate_tiktok_content('Payment After Visa', count=1)
print(json.dumps(result, indent=2, ensure_ascii=False))
" 2>/dev/null || echo "⚠️  Demo requires working API connection"
        ;;
    
    help|menu|*)
        echo "Usage: ./run.sh [command] [options]"
        echo ""
        echo "Commands:"
        echo "  full [month] [year] [theme]   Run complete pipeline"
        echo "  calendar [month] [year]         Generate content calendar"
        echo "  content [topic]                 Generate TikTok content"
        echo "  campaign [name]                 Generate ad campaign"
        echo "  report                          Generate weekly report"
        echo "  scale                           Get scaling recommendations"
        echo "  test                            Run demo/test"
        echo "  help                            Show this menu"
        echo ""
        echo "Examples:"
        echo "  ./run.sh full 7 2026 'July Scholarship'"
        echo "  ./run.sh content 'CSCA Free Admission'"
        echo "  ./run.sh campaign csca_free"
        echo "  ./run.sh report"
        echo "  ./run.sh scale"
        ;;
esac

echo ""
echo "✅ Done!"
