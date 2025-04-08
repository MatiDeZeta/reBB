/**
 * form.js - Form handling and template processing
 * This file handles the initialization, submission, and output generation for forms
 */

// Store a reference to the form instance so we can access it from event handlers
let formInstance = null;

// Wait for all scripts to load before initializing the form
document.addEventListener('DOMContentLoaded', function() {
    // Track form usage
    trackFormUsage(false);
    
    // Initialize with a delay to ensure ComponentRegistry is available
    setTimeout(function() {
        initializeFormWithComponents();
    }, 100);
    
    // Add handler for Autogrammar functionality
    document.addEventListener('input', function(event) {
        // Check if the target is an input or textarea in a formio component
        if ((event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') && 
            (event.target.closest('.formio-component-textfield') || event.target.closest('.formio-component-textarea'))) {
            
            // Make sure we have a form instance
            if (!formInstance) return;
            
            // Extract the component key from the input's name attribute (format is data[key])
            let inputName = event.target.name;
            if (!inputName) return;
            
            // Extract the component key from name="data[componentKey]" format
            let matches = inputName.match(/data\[(.*?)\]/);
            if (!matches || matches.length < 2) return;
            
            let componentKey = matches[1];
            
            // Now find the component in the form schema
            const component = findComponentByKey(formInstance.form.components, componentKey);
            
            // If component has autogrammar enabled, apply transformation
            if (component && component.case == 'autogrammar') {
                const value = event.target.value;
                if (value) {
                    // Capitalize first letter, lowercase the rest
                    const transformed = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
                    
                    // Only update if it's different to avoid input loop
                    if (value !== transformed) {
                        // Get cursor position
                        const cursorPos = event.target.selectionStart;
                        
                        // Update value
                        event.target.value = transformed;
                        
                        // Restore cursor position
                        event.target.setSelectionRange(cursorPos, cursorPos);
                    }
                }
            }
        }
    });
});

// Recursive function to find a component by its key in the component tree
function findComponentByKey(components, key) {
    if (!components) return null;
    
    for (let i = 0; i < components.length; i++) {
        const component = components[i];
        
        // Direct match
        if (component.key === key) {
            return component;
        }
        
        // Search in nested components (columns, panels, containers, etc.)
        if (component.components) {
            const found = findComponentByKey(component.components, key);
            if (found) return found;
        }
        
        // Search in columns
        if (component.columns) {
            for (let j = 0; j < component.columns.length; j++) {
                if (component.columns[j].components) {
                    const found = findComponentByKey(component.columns[j].components, key);
                    if (found) return found;
                }
            }
        }
        
        // Search in rows (for datagrid-like components)
        if (component.rows) {
            for (let j = 0; j < component.rows.length; j++) {
                for (let k = 0; k < component.rows[j].length; k++) {
                    if (component.rows[j][k].components) {
                        const found = findComponentByKey(component.rows[j][k].components, key);
                        if (found) return found;
                    }
                }
            }
        }
    }
    
    return null;
}

// Initialize form with components loaded first
function initializeFormWithComponents() {
    console.log('Initializing form with components...');
    
    // If ComponentRegistry is available, use it
    if (window.ComponentRegistry) {
        const basePath = ASSETS_BASE_PATH || '';
        console.log('Component Registry found, initializing components from:', basePath);
        
        // Initialize the registry and wait for components to load
        ComponentRegistry.init(basePath)
            .then(function() {
                console.log('Components loaded successfully, creating form...');
                setTimeout(function() {
                    // Double-check component registration
                    verifyComponentRegistration();
                    // Create the form
                    createFormWithSchema();
                }, 100); // Small delay to ensure components are fully registered
            })
            .catch(function(error) {
                console.error('Failed to load components:', error);
                // Create form even if component loading fails
                createFormWithSchema();
            });
    } else {
        console.warn('ComponentRegistry not found, proceeding without custom components');
        // Create form without custom components
        createFormWithSchema();
    }
}

// Verify component registration
function verifyComponentRegistration() {
    return null;
}

// Create the form with schema
function createFormWithSchema() {
    console.log('Creating form with schema...');
    
    // Create the actual form with Form.io
    Formio.createForm(document.getElementById('formio'), formSchema, { noAlerts: true })
        .then(function(form) {
            console.log('Form created successfully');
            // Store form instance globally so we can access it in event handlers
            formInstance = form;
            setupFormEventHandlers(form);
        })
        .catch(function(error) {
            console.error('Form initialization error:', error);
            document.getElementById('form-container').innerHTML = `
                <div class="alert alert-danger">
                    Error loading form: ${error.message}
                </div>
            `;
        });
}

// Set up all form event handlers
function setupFormEventHandlers(form) {
    const outputContainer = document.getElementById('output-container');
    const outputField = document.getElementById('output');
    const copyButton = document.getElementById('copyOutputBtn');
    const templateTitleContainer = document.getElementById('template-title-container');
    const generatedTitleField = document.getElementById('generated-title');
    const postContentBtn = document.getElementById('postContentBtn');
    
    // Initialize template title and link features based on toggle states
    if (typeof enableTemplateTitle !== 'undefined' && enableTemplateTitle && 
        typeof formTemplateTitle !== 'undefined' && formTemplateTitle) {
        templateTitleContainer.style.display = 'block';
    } else {
        templateTitleContainer.style.display = 'none';
    }

    if (typeof enableTemplateLink !== 'undefined' && enableTemplateLink && 
        typeof formTemplateLink !== 'undefined' && formTemplateLink) {
        postContentBtn.style.display = 'inline-block';
        postContentBtn.href = formTemplateLink;
    } else {
        postContentBtn.style.display = 'none';
    }
    
    // Initialize the copy button functionality
    if (copyButton) {
        copyButton.addEventListener('click', function() {
            if (outputField.value) {
                copyToClipboard(outputField.value)
                    .then(() => {
                        // Show feedback that copy was successful
                        const originalText = copyButton.innerHTML;
                        copyButton.innerHTML = '<i class="bi bi-check-lg"></i> Copied!';
                        
                        // Reset button text after delay
                        setTimeout(() => {
                            copyButton.innerHTML = originalText;
                        }, 2000);
                    })
                    .catch(err => {
                        console.error('Copy failed:', err);
                        alert('Could not copy to clipboard. Please try selecting and copying manually.');
                    });
            }
        });
    }
    
    // Ensure every datagrid starts with one empty row that will be hidden
    // and a second visible row for the user
    setTimeout(() => {
        Object.keys(form.components).forEach(key => {
            const component = form.getComponent(key);
            if (component && component.type === 'datagrid') {
                // Make sure we always have at least 2 rows (first hidden, second visible)
                if (component.rows && component.rows.length < 2) {
                    component.addRow();
                }
            }
        });
    }, 500);

    // Handle form submission
    form.on('submit', function(submission) {
        // Apply autogrammar transformation to the original form data
        Object.keys(submission.data).forEach(key => {
            const component = findComponentByKey(form.form.components, key);
            if (component && component.case === 'autogrammar' && submission.data[key]) {
                // Apply the transform: first letter uppercase, rest lowercase
                submission.data[key] = submission.data[key].charAt(0).toUpperCase() + 
                                      submission.data[key].slice(1).toLowerCase();
            }
        });
        
        // Clone the transformed data to prevent any issues with form reset
        const submissionCopy = JSON.parse(JSON.stringify(submission.data));
        
        // Rest of your existing date input processing, etc.
        document.querySelectorAll('input[type="hidden"][value*="T"]').forEach(hiddenInput => {
            const key = hiddenInput.name.replace('data[', '').replace(']', '');
            
            // Find the visible input next to this hidden input
            const visibleInput = hiddenInput.nextElementSibling;
            
            if (visibleInput && visibleInput.classList.contains('input') && key in submissionCopy) {
                // Replace the ISO date with the displayed date value
                submissionCopy[key] = visibleInput.value;
            }
        });
        
        // Process the template with our updated data, passing the form schema
        const generatedOutput = processTemplate(formTemplate, submissionCopy, form.form);
        outputField.value = generatedOutput;
        
        // Process template title if it's enabled and exists
        if (typeof enableTemplateTitle !== 'undefined' && enableTemplateTitle && 
            typeof formTemplateTitle !== 'undefined' && formTemplateTitle) {
            const generatedTitle = processTemplate(formTemplateTitle, submissionCopy, form.form);
            generatedTitleField.value = generatedTitle;
            templateTitleContainer.style.display = 'block';
        }
        
        trackFormUsage(true);
        form.emit('submitDone');
    });
}

// Process template with data
function processTemplate(template, data) {
    // Create a recursive decode function to handle multiple levels of HTML entity encoding
    function decodeHTMLEntities(text) {
        const textArea = document.createElement('textarea');
        textArea.innerHTML = text;
        const decoded = textArea.value;
        
        // If the decoded text is different from the input, it might have more entities to decode
        if (decoded !== text && decoded.includes('&')) {
            // Recursively decode until no more changes
            return decodeHTMLEntities(decoded);
        }
        return decoded;
    }

    // Process all form data to expand options for select boxes and other components
    // But ONLY for non-datagrid fields
    function processFormData(formData) {
        const processedData = {...formData};
        
        // Process all values in the data object
        Object.keys(formData).forEach(key => {
            const value = formData[key];
            
            // Skip processing arrays (which might be datagrids)
            if (Array.isArray(value)) {
                return;
            }
            
            // Handle selectboxes component - {"option1": true, "option2": false}
            if (value && typeof value === 'object') {
                const keys = Object.keys(value);
                
                // Check if this is a selectboxes component (has boolean values)
                const allBooleanValues = keys.length > 0 && 
                    keys.every(optionKey => typeof value[optionKey] === 'boolean');
                
                if (allBooleanValues) {
                    // 1. Create individual wildcards for each option
                    keys.forEach(optionKey => {
                        const wildcard = `${key}_${optionKey}`;
                        // If the option is selected (true), set the wildcard to the option key
                        // Otherwise, set it to empty string
                        processedData[wildcard] = value[optionKey] ? optionKey : '';
                    });
                    
                    // 2. Set the main component value to a space-separated list of selected options
                    processedData[key] = keys
                        .filter(optionKey => value[optionKey])
                        .join(' ');
                }
                // Handle single select with value/label properties
                else if (value.value !== undefined) {
                    processedData[key] = value.value;
                }
            }
        });
        
        return processedData;
    }

    // Process survey components to create individual question wildcards
    function processSurveyData(formData) {
        const processedData = {...formData};
        
        // Look for survey components in the data
        Object.keys(formData).forEach(key => {
            const value = formData[key];
            
            // Skip arrays (which might be datagrids)
            if (Array.isArray(value)) {
                return;
            }
            
            // If the value is an object, it might be a survey component
            if (value && typeof value === 'object') {
                // Skip objects that we've already determined are selectboxes
                const keys = Object.keys(value);
                const allBooleanValues = keys.length > 0 && 
                    keys.every(optionKey => typeof value[optionKey] === 'boolean');
                
                // Only process if it's not a selectboxes component
                if (!allBooleanValues) {
                    // Get the question values and find out how many questions there are
                    const questionKeys = Object.keys(value);
                    
                    questionKeys.forEach((questionKey, index) => {
                        // Only create keys for questions that have answers (not undefined, null, or empty)
                        if (value[questionKey] !== undefined && value[questionKey] !== null && value[questionKey] !== '') {
                            // Create the traditional combined key for backward compatibility
                            const traditionalKey = `${key}_${questionKey}`;
                            processedData[traditionalKey] = value[questionKey];
                            
                            // Create the new shortened key format with question number
                            // Extract the base question key (without long text)
                            const shortKey = questionKey.substring(0, 15).replace(/[^A-Za-z0-9]/g, '');
                            const numberedKey = `${key}_${shortKey}${index + 1}`;
                            processedData[numberedKey] = value[questionKey];
                        }
                    });
                }
            }
        });
        
        return processedData;
    }

    // Decode the template before processing it
    template = decodeHTMLEntities(template);

    // Process input data for non-datagrid fields
    data = processFormData(data);
    data = processSurveyData(data);
  
    let processedTemplate = '';
    let currentIndex = 0;
    const customEntryRegex = /\{@START_(\w+)@\}([\s\S]*?)\{@END_\1@\}/g;
    let match;

    while ((match = customEntryRegex.exec(template)) !== null) {
        const componentId = match[1];
        const sectionContent = match[2];
        let componentData = data[componentId] || [];
        
        processedTemplate += template.substring(currentIndex, match.index);
        
        if (Array.isArray(componentData)) {
            // REVERT TO THE SIMPLE APPROACH FOR DATAGRIDS
            
            // HACK: Skip the first row of each datagrid
            if (componentData.length > 0) {
                componentData = componentData.slice(1);
            }
            
            // Find field keys by examining non-empty rows
            const fieldKeys = new Set();
            componentData.forEach(row => {
                if (row && typeof row === 'object' && !Array.isArray(row)) {
                    Object.keys(row).forEach(key => fieldKeys.add(key));
                }
            });
            
            // Process rows (skipping the first one) - USING THE OLD SIMPLE APPROACH
            componentData.forEach((rowData, index) => {
                let rowContent = sectionContent;
                
                // Convert empty arrays to empty objects
                if (Array.isArray(rowData) && rowData.length === 0) {
                    rowData = {};
                }
                
                // Handle case where rowData is null or undefined
                if (!rowData) rowData = {};
                
                // SIMPLE DIRECT REPLACEMENT WITHOUT ANY EXTRA PROCESSING
                rowContent = rowContent.replace(/\{(\w+)\}/g, (placeholder, key) => {
                    // Direct access to rowData
                    return rowData[key] !== undefined ? rowData[key] : '';
                });
                
                processedTemplate += rowContent;
            });
        } else if (componentId in data) {
            // Handle non-datagrid fields
            let content = sectionContent;
            content = content.replace(/\{(\w+)\}/g, (placeholder, key) => {
                return key in data ? data[key] : '';
            });
            processedTemplate += content;
        }
        
        currentIndex = match.index + match[0].length;
    }

    processedTemplate += template.substring(currentIndex);
    
    // Process regular placeholders outside of START/END blocks
    processedTemplate = processedTemplate.replace(/\{(\w+)\}/g, (match, key) => {
        return (data[key] !== undefined && data[key] !== null) ? data[key] : '';
    });
    
    return processedTemplate;
}

function trackFormUsage(isSubmission = false) {
    // Extract form ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const formId = urlParams.get('f');
    
    if (formId) {
        fetch('ajax', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'analytics',
                action: 'track_form',
                formId: formId,
                isSubmission: isSubmission
            })
        }).catch(err => console.warn('Analytics error:', err));
    }
}

/**
* Copy text to clipboard function
* @param {string} text - The text to copy
* @returns {Promise} - Resolves when copy is successful
*/
function copyToClipboard(text) {
  // Modern approach - Clipboard API (not supported in all browsers)
  if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(text);
  }
  
  // Fallback approach - Create a temporary element and copy from it
  return new Promise((resolve, reject) => {
      try {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.style.position = 'fixed';  // Avoid scrolling to bottom
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          
          // Execute the copy command
          const successful = document.execCommand('copy');
          document.body.removeChild(textarea);
          
          if (successful) {
              resolve();
          } else {
              reject(new Error('Unable to copy'));
          }
      } catch (err) {
          reject(err);
      }
  });
}