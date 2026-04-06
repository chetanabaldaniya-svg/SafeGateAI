const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Find the start of the residents block
const startMarker = "          {mode === 'residents' ? (";
const endMarker = "          ) : (\n          <form className=\"space-y-6\" onSubmit={handleCheckIn}>";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  // Extract the block
  const residentsBlock = content.substring(startIndex + startMarker.length, endIndex);
  
  // Remove the block from the original location
  content = content.substring(0, startIndex) + "          <form className=\"space-y-6\" onSubmit={handleCheckIn}>" + content.substring(endIndex + endMarker.length);
  
  // Find where to insert the residents page
  const insertMarker = "      {currentPage === 'dashboard' ? (";
  const insertIndex = content.indexOf(insertMarker);
  
  if (insertIndex !== -1) {
    // We need to close the dashboard div and add the residents div
    // The dashboard ends at the very end of the file, before the last </div></div>
    
    const endOfDashboardMarker = "        </div>\n      </div>\n      ) : (\n        <div className=\"w-full max-w-4xl\">\n          <div className=\"bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10 border border-slate-100\">\n            <h2 className=\"text-2xl font-bold text-slate-900 mb-6\">Resident Management</h2>\n" + residentsBlock + "\n          </div>\n        </div>\n      )}\n    </div>\n  );\n}\n";
    
    // Replace the end of the file
    content = content.replace(/      <\/div>\n    <\/div>\n  \);\n}\n?$/, endOfDashboardMarker);
    
    fs.writeFileSync('src/App.tsx', content);
    console.log("Refactoring successful!");
  } else {
    console.log("Insert marker not found");
  }
} else {
  console.log("Start or end marker not found");
}
