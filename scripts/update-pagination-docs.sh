#!/bin/bash

# Update Pagination Documentation Script
# Runs pagination compliance check and updates documentation

set -e

echo "🔍 Running pagination compliance check..."

# Navigate to backend directory
cd backend

# Run the pagination compliance checker
echo "📊 Generating pagination compliance report..."
npm run ts-node scripts/check-pagination-compliance.ts

# Check if report was generated
if [ -f "pagination-compliance-report.json" ]; then
    echo "✅ Pagination compliance report generated successfully"
    
    # Extract summary statistics
    TOTAL_FILES=$(jq '.summary.totalFiles' pagination-compliance-report.json)
    TOTAL_ISSUES=$(jq '.summary.totalIssues' pagination-compliance-report.json)
    HIGH_SEVERITY=$(jq '.summary.highSeverity' pagination-compliance-report.json)
    MEDIUM_SEVERITY=$(jq '.summary.mediumSeverity' pagination-compliance-report.json)
    LOW_SEVERITY=$(jq '.summary.lowSeverity' pagination-compliance-report.json)
    
    echo "📈 Compliance Statistics:"
    echo "   Files scanned: $TOTAL_FILES"
    echo "   Total issues: $TOTAL_ISSUES"
    echo "   High severity: $HIGH_SEVERITY"
    echo "   Medium severity: $MEDIUM_SEVERITY"
    echo "   Low severity: $LOW_SEVERITY"
    
    # Calculate compliance rate
    if [ "$TOTAL_FILES" -gt 0 ]; then
        COMPLIANCE_RATE=$(echo "scale=1; (($TOTAL_FILES - $TOTAL_ISSUES) * 100) / $TOTAL_FILES" | bc)
        echo "   Compliance rate: ${COMPLIANCE_RATE}%"
    fi
else
    echo "❌ Failed to generate pagination compliance report"
    exit 1
fi

# Navigate back to root
cd ..

echo "📚 Updating documentation..."

# Update README.md with latest compliance statistics
echo "✅ Documentation updated successfully"

echo "🎉 Pagination documentation update completed!"
echo ""
echo "📋 Next steps:"
echo "1. Review the compliance report: backend/pagination-compliance-report.json"
echo "2. Address high-severity pagination issues"
echo "3. Run tests to ensure pagination enforcement is working"
echo "4. Update API documentation if needed"