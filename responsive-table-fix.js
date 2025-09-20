// Simple responsive table enhancement
// Add this CSS to make tables responsive

const responsiveTableStyles = `
/* Responsive Table Styles */
@media (max-width: 1024px) {
  .table-responsive {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .table-responsive table {
    min-width: 800px;
  }

  .table-responsive th,
  .table-responsive td {
    padding: 8px 12px;
    font-size: 14px;
  }
}

@media (max-width: 768px) {
  .table-responsive table {
    min-width: 600px;
  }

  .table-responsive th,
  .table-responsive td {
    padding: 6px 8px;
    font-size: 12px;
  }
}

/* Mobile First Card Layout */
@media (max-width: 640px) {
  .mobile-cards {
    display: block;
  }

  .desktop-table {
    display: none;
  }

  .order-card {
    background: white;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .order-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .order-card-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    font-size: 14px;
  }

  .order-card-actions {
    margin-top: 12px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
}
`;

// Apply the styles
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = responsiveTableStyles;
document.head.appendChild(styleSheet);
