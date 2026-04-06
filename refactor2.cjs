const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

const startMarker = "        <div className=\"w-full max-w-4xl\">\n          <div className=\"bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10 border border-slate-100\">\n            <h2 className=\"text-2xl font-bold text-slate-900 mb-6\">Resident Management</h2>";
const endMarker = "          </div>\n        </div>\n      )}\n    </div>\n  );\n}\n";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  const newResidentsBlock = `        <div className="w-full max-w-5xl">
          <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10 border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Resident Management</h2>
                <p className="text-sm text-slate-500 mt-1">Add new residents and manage their verification status.</p>
              </div>
              <div className="bg-blue-50 p-2 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              {/* Left Column: Add Resident */}
              <div className="md:col-span-5 space-y-6">
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                    <UserPlus className="h-5 w-5 mr-2 text-slate-500" />
                    Add New Resident
                  </h3>
                  
                  {showVerificationPrompt && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 relative mb-6">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <Info className="h-5 w-5 text-blue-400" />
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-blue-800">Verification Required</h3>
                          <div className="mt-2 text-sm text-blue-700">
                            <p>Residents must verify their email address before they can approve or deny delivery requests.</p>
                          </div>
                        </div>
                      </div>
                      {residents.some(r => r.isVerified) && (
                        <button
                          type="button"
                          onClick={() => setShowVerificationPrompt(false)}
                          className="absolute top-2 right-2 p-1 bg-blue-50 text-blue-500 hover:bg-blue-100 rounded-md transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}

                  <form onSubmit={handleAddResident} className="space-y-4">
                    <div>
                      <label htmlFor="residentFlat" className="block text-sm font-medium text-slate-700">
                        Flat Number
                      </label>
                      <div className="mt-1">
                        <input
                          id="residentFlat"
                          type="text"
                          required
                          value={residentFlat}
                          onChange={(e) => setResidentFlat(e.target.value)}
                          className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                          placeholder="e.g. 101"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="residentEmail" className="block text-sm font-medium text-slate-700">
                        Resident Email
                      </label>
                      <div className="mt-1">
                        <input
                          id="residentEmail"
                          type="email"
                          required
                          value={residentEmail}
                          onChange={(e) => setResidentEmail(e.target.value)}
                          className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                          placeholder="e.g. resident@example.com"
                        />
                      </div>
                    </div>
                    
                    {residentMessage && (
                      <div className={\`rounded-md p-3 border text-sm font-medium \${residentMessage.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}\`}>
                        {residentMessage.text}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={residentLoading}
                      className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed transition-colors mt-2"
                    >
                      {residentLoading ? (
                        <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                      ) : (
                        <Mail className="h-5 w-5 mr-2" />
                      )}
                      Send Verification Link
                    </button>
                  </form>
                </div>
              </div>

              {/* Right Column: Resident List or Profile */}
              <div className="md:col-span-7">
                {selectedResident ? (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300 h-full">
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm h-full flex flex-col">
                      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                        <div className="flex items-center">
                          <button 
                            onClick={() => setSelectedResident(null)}
                            className="mr-3 text-slate-400 hover:text-slate-600 transition-colors bg-white p-1.5 rounded-md border border-slate-200 shadow-sm"
                          >
                            <ArrowDown className="h-4 w-4 rotate-90" />
                          </button>
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900">Flat {selectedResident.flatNumber}</h3>
                            <p className="text-sm text-slate-500">{selectedResident.email}</p>
                          </div>
                        </div>
                        {selectedResident.isVerified ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle2 className="h-4 w-4 mr-1.5" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            <Clock className="h-4 w-4 mr-1.5" /> Pending
                          </span>
                        )}
                      </div>
                      
                      <div className="p-8 flex flex-col items-center justify-center flex-grow">
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6">
                          <QRCodeSVG 
                            value={JSON.stringify({ flatNumber: selectedResident.flatNumber, email: selectedResident.email })} 
                            size={200}
                            level="H"
                            includeMargin={true}
                          />
                        </div>
                        <h4 className="text-base font-medium text-slate-900 mb-2">Resident QR Code</h4>
                        <p className="text-sm text-slate-500 text-center max-w-sm">
                          This QR code contains the resident's flat number and email address. It can be used for quick identification at the gate.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm h-full flex flex-col">
                    <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
                      <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                        <Users className="h-5 w-5 mr-2 text-slate-500" />
                        Registered Residents
                        <span className="ml-2 bg-slate-200 text-slate-700 py-0.5 px-2 rounded-full text-xs font-medium">
                          {residents.length}
                        </span>
                      </h3>
                    </div>
                    
                    <div className="p-0 flex-grow overflow-y-auto max-h-[600px]">
                      {residents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                          <div className="bg-slate-100 p-3 rounded-full mb-3">
                            <Users className="h-8 w-8 text-slate-400" />
                          </div>
                          <p className="text-base font-medium text-slate-900 mb-1">No residents found</p>
                          <p className="text-sm text-slate-500">Add a resident using the form to get started.</p>
                        </div>
                      ) : (
                        <ul className="divide-y divide-slate-100">
                          {residents.map(r => (
                            <li 
                              key={r.id} 
                              onClick={() => setSelectedResident(r)}
                              className="flex items-center justify-between p-4 hover:bg-slate-50 cursor-pointer transition-colors group"
                            >
                              <div className="flex items-center">
                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold mr-4">
                                  {r.flatNumber.substring(0, 3)}
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-slate-900">Flat {r.flatNumber}</div>
                                  <div className="text-xs text-slate-500">{r.email}</div>
                                </div>
                              </div>
                              <div className="flex items-center">
                                {r.isVerified ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-4">
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Verified
                                  </span>
                                ) : (
                                  <div className="flex items-center mr-4">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 mr-2">
                                      <Clock className="h-3.5 w-3.5 mr-1" /> Pending
                                    </span>
                                    <button
                                      onClick={(e) => handleMockVerify(r.id, e)}
                                      className="text-xs bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-blue-600 px-2.5 py-1 rounded-md transition-colors font-medium shadow-sm"
                                    >
                                      Mock Verify
                                    </button>
                                  </div>
                                )}
                                <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>`;
            
  content = content.substring(0, startIndex) + newResidentsBlock + content.substring(endIndex);
  
  // Also need to add UserPlus to lucide-react imports
  if (!content.includes('UserPlus')) {
    content = content.replace("Users,", "Users, UserPlus,");
  }
  
  fs.writeFileSync('src/App.tsx', content);
  console.log("Refactoring successful!");
} else {
  console.log("Start or end marker not found");
}
