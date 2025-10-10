// --- GLOBAL STATE ---
let lastRightClickedElement = null;

// --- EVENT LISTENERS ---

// Listen for messages from the background script (context menu) or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "FILL_FORM") {
        const profile = message.data;
        console.log("Form Filler: Received profile data", profile);
        fillForms(profile);
        sendResponse({ status: "success" });
    } else if (message.action === "MAP_FIELD") {
        handleMapField(message.profileKey);
        sendResponse({ status: "mapping started" });
    }
});

// Track the last element the user right-clicked on
document.addEventListener('contextmenu', (event) => {
    lastRightClickedElement = event.target;
}, true);


// --- LEARNING & MAPPING LOGIC ---

function handleMapField(profileKey) {
    if (!lastRightClickedElement) {
        console.error("Form Filler: Cannot map field, no element was right-clicked.");
        return;
    }

    // Generate a unique and stable selector for the element
    const selector = generateCssSelector(lastRightClickedElement);
    if (!selector) {
        console.error("Form Filler: Could not generate a unique selector for the element.");
        return;
    }

    console.log(`Form Filler: Mapping selector "${selector}" to profile key "${profileKey}"`);

    // Save the new mapping rule to storage
    chrome.storage.sync.get('customMappings', (data) => {
        const mappings = data.customMappings || {};
        mappings[selector] = profileKey;
        chrome.storage.sync.set({ customMappings: mappings }, () => {
            console.log("Form Filler: New mapping saved!");
        });
    });
}

// Helper to generate a CSS selector for an element
function generateCssSelector(el) {
    if (el.id) return `#${el.id}`;
    if (el.name) return `[name="${el.name}"]`;
    // Fallback for elements without id or name (can be brittle)
    if (el.tagName) {
        let selector = el.tagName.toLowerCase();
        if (el.className) {
            selector += `.${el.className.trim().split(/\s+/).join('.')}`;
        }
        return selector;
    }
    return null;
}


// --- FILLING LOGIC ---

function dispatchEvents(element) {
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
}

function fillInput(element, value) {
    if (!element || value === undefined || value === null) return;
    element.value = value;
    dispatchEvents(element);
    console.log(`Filled '${element.name || element.id || 'element'}' with value: ${value}`);
}

function findElementsByKeywords(keywords, scope = document, elementType = 'input, textarea') {
    const allElements = Array.from(scope.querySelectorAll(elementType));
    const matchingElements = [];
    
    allElements.forEach(element => {
        const attributesText = [
            element.id,
            element.name,
            element.placeholder,
            element.getAttribute('aria-label'),
            element.labels?.[0]?.textContent
        ].join(' ').toLowerCase();

        if (keywords.some(keyword => attributesText.includes(keyword.toLowerCase()))) {
            matchingElements.push(element);
        }
    });
    return matchingElements;
}

function findSectionContainers(keywords, stopKeywords = []) {
    const potentialContainers = document.querySelectorAll('div, fieldset, li, section');
    const matchingContainers = [];

    potentialContainers.forEach(container => {
        if (container.querySelector('input, textarea')) {
            const containerText = container.innerText.toLowerCase();
            
            // If a container includes a stop word, it belongs to another section, so we skip it.
            if (stopKeywords.some(stopWord => containerText.includes(stopWord))) {
                return;
            }

            if (keywords.some(keyword => containerText.includes(keyword))) {
                if (container.querySelectorAll('input, textarea, select').length >= 2) {
                     if (!matchingContainers.some(mc => mc.contains(container))) {
                        matchingContainers.push(container);
                     }
                }
            }
        }
    });
    return matchingContainers;
}

async function fillForms(profile) {
    let filledElements = new Set(); 

    console.log("--- Starting Custom Mappings (Learned Fields) ---");
    const { customMappings } = await chrome.storage.sync.get('customMappings');
    if (customMappings) {
        for (const selector in customMappings) {
            const element = document.querySelector(selector);
            if (element) {
                const profileKey = customMappings[selector];
                let value;
                if (profileKey.startsWith('custom.')) {
                    const customKey = profileKey.substring(7); 
                    value = profile.customFields ? profile.customFields[customKey] : undefined;
                } else {
                    value = profile[profileKey];
                }
                
                if (value !== undefined) {
                    fillInput(element, value);
                    filledElements.add(element);
                }
            }
        }
    }
    
    console.log("--- Starting Personal Info (Keyword Search) ---");
    const singleFieldMappings = {
        'firstName': ['first name', 'firstname', 'fname', 'given-name'],
        'lastName': ['last name', 'lastname', 'lname', 'surname', 'family-name'],
        'email': ['email'],
        'phone': ['phone', 'mobile', 'tel'],
        'linkedin': ['linkedin'],
        'github': ['github'],
        'portfolio': ['portfolio', 'website', 'url'],
        'coverLetter': ['cover letter', 'cover-letter', 'additional information', 'summary']
    };
    for (const key in singleFieldMappings) {
        if (profile[key]) {
            const elements = findElementsByKeywords(singleFieldMappings[key]);
            const elementToFill = elements.find(el => !filledElements.has(el));
            if (elementToFill) {
                 fillInput(elementToFill, profile[key]);
                 filledElements.add(elementToFill);
            }
        }
    }

    const workKeywords = ['experience', 'work', 'employment'];
    const educationKeywords = ['education', 'school', 'university', 'academic'];

    console.log("--- Starting Work Experience ---");
    if (profile.workExperience && profile.workExperience.length > 0) {
        const workContainers = findSectionContainers(workKeywords, educationKeywords);
        console.log(`Found ${workContainers.length} potential work containers.`);
        
        profile.workExperience.forEach((job, index) => {
            const container = workContainers[index];
            if (!container) {
                console.log(`No container found for work experience item #${index + 1}`);
                return;
            }
            console.log(`Filling work experience #${index + 1} within its container.`);
            
            fillInput(findElementsByKeywords(['title', 'position'], container)[0], job.title);
            fillInput(findElementsByKeywords(['company', 'employer'], container)[0], job.company);
            fillInput(findElementsByKeywords(['responsibilities', 'duties', 'description', 'summary'], container)[0], job.responsibilities);
            fillInput(findElementsByKeywords(['start date', 'from'], container)[0], job.startDate);
            fillInput(findElementsByKeywords(['end date', 'to'], container)[0], job.endDate);
        });
    }

    console.log("--- Starting Education ---");
     if (profile.education && profile.education.length > 0) {
        const educationContainers = findSectionContainers(educationKeywords, workKeywords);
        console.log(`Found ${educationContainers.length} potential education containers.`);

        profile.education.forEach((edu, index) => {
            const container = educationContainers[index];
             if (!container) {
                console.log(`No container found for education item #${index + 1}`);
                return;
            }
            console.log(`Filling education #${index + 1} within its container.`);
            
            fillInput(findElementsByKeywords(['school', 'university', 'institution'], container)[0], edu.school);
            fillInput(findElementsByKeywords(['degree'], container)[0], edu.degree);
            fillInput(findElementsByKeywords(['field of study', 'major', 'discipline'], container)[0], edu.fieldOfStudy);
            fillInput(findElementsByKeywords(['start date', 'from'], container)[0], edu.startDate);
            fillInput(findElementsByKeywords(['end date', 'to'], container)[0], edu.endDate);
        });
    }
    console.log("--- Form Filler: Finished ---");
}

