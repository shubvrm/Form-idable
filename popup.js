document.addEventListener('DOMContentLoaded', () => {
    const saveButton = document.getElementById('save-btn');
    const fillButton = document.getElementById('fill-btn');
    const statusMessage = document.getElementById('status-message');
    const addWorkBtn = document.getElementById('add-work-btn');
    const addEducationBtn = document.getElementById('add-education-btn');
    const workEntriesContainer = document.getElementById('work-experience-entries');
    const educationEntriesContainer = document.getElementById('education-entries');

    // --- Template for a work experience entry ---
    const createWorkEntry = (work = {}) => {
        const div = document.createElement('div');
        div.className = 'entry-card space-y-2';
        div.innerHTML = `
            <button class="remove-btn" title="Remove entry">X</button>
            <input type="text" placeholder="Job Title" class="w-full px-2 py-1 border rounded data-title" value="${work.title || ''}">
            <input type="text" placeholder="Company" class="w-full px-2 py-1 border rounded data-company" value="${work.company || ''}">
            <textarea placeholder="Key Responsibilities..." class="w-full px-2 py-1 border rounded h-16 data-responsibilities">${work.responsibilities || ''}</textarea>
            <div class="flex space-x-2">
                <input type="text" placeholder="Start Date (MM/YYYY)" class="w-1/2 px-2 py-1 border rounded data-startDate" value="${work.startDate || ''}">
                <input type="text" placeholder="End Date (MM/YYYY)" class="w-1/2 px-2 py-1 border rounded data-endDate" value="${work.endDate || ''}">
            </div>
        `;
        div.querySelector('.remove-btn').addEventListener('click', () => div.remove());
        workEntriesContainer.appendChild(div);
    };

    // --- Template for an education entry ---
    const createEducationEntry = (edu = {}) => {
        const div = document.createElement('div');
        div.className = 'entry-card space-y-2';
        div.innerHTML = `
            <button class="remove-btn" title="Remove entry">X</button>
            <input type="text" placeholder="School / University" class="w-full px-2 py-1 border rounded data-school" value="${edu.school || ''}">
            <input type="text" placeholder="Degree (e.g., B.S.)" class="w-full px-2 py-1 border rounded data-degree" value="${edu.degree || ''}">
            <input type="text" placeholder="Field of Study (e.g., Computer Science)" class="w-full px-2 py-1 border rounded data-fieldOfStudy" value="${edu.fieldOfStudy || ''}">
             <div class="flex space-x-2">
                <input type="text" placeholder="Start Date (MM/YYYY)" class="w-1/2 px-2 py-1 border rounded data-startDate" value="${edu.startDate || ''}">
                <input type="text" placeholder="End Date (MM/YYYY)" class="w-1/2 px-2 py-1 border rounded data-endDate" value="${edu.endDate || ''}">
            </div>
        `;
        div.querySelector('.remove-btn').addEventListener('click', () => div.remove());
        educationEntriesContainer.appendChild(div);
    };

    addWorkBtn.addEventListener('click', () => createWorkEntry());
    addEducationBtn.addEventListener('click', () => createEducationEntry());

    // --- Load saved data when popup opens ---
    const loadProfile = () => {
        chrome.storage.sync.get('userProfile', (data) => {
            if (!data.userProfile) return;
            const profile = data.userProfile;
            document.getElementById('firstName').value = profile.firstName || '';
            document.getElementById('lastName').value = profile.lastName || '';
            document.getElementById('email').value = profile.email || '';
            document.getElementById('phone').value = profile.phone || '';
            document.getElementById('linkedin').value = profile.linkedin || '';
            document.getElementById('github').value = profile.github || '';
            document.getElementById('portfolio').value = profile.portfolio || '';
            document.getElementById('coverLetter').value = profile.coverLetter || '';
            
            workEntriesContainer.innerHTML = '';
            (profile.workExperience || []).forEach(createWorkEntry);
            
            educationEntriesContainer.innerHTML = '';
            (profile.education || []).forEach(createEducationEntry);
        });
    };
    
    // --- Save button logic ---
    saveButton.addEventListener('click', () => {
        const workExperience = Array.from(workEntriesContainer.querySelectorAll('.entry-card')).map(div => ({
            title: div.querySelector('.data-title').value,
            company: div.querySelector('.data-company').value,
            responsibilities: div.querySelector('.data-responsibilities').value,
            startDate: div.querySelector('.data-startDate').value,
            endDate: div.querySelector('.data-endDate').value,
        }));

        const education = Array.from(educationEntriesContainer.querySelectorAll('.entry-card')).map(div => ({
            school: div.querySelector('.data-school').value,
            degree: div.querySelector('.data-degree').value,
            fieldOfStudy: div.querySelector('.data-fieldOfStudy').value,
            startDate: div.querySelector('.data-startDate').value,
            endDate: div.querySelector('.data-endDate').value,
        }));

        const userProfile = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            linkedin: document.getElementById('linkedin').value,
            github: document.getElementById('github').value,
            portfolio: document.getElementById('portfolio').value,
            coverLetter: document.getElementById('coverLetter').value,
            workExperience,
            education
        };

        chrome.storage.sync.set({ userProfile }, () => {
            statusMessage.textContent = 'Profile saved successfully!';
            setTimeout(() => statusMessage.textContent = '', 2000);
        });
    });

    // --- Fill button logic ---
    fillButton.addEventListener('click', async () => {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            chrome.storage.sync.get('userProfile', (data) => {
                if (!data.userProfile) {
                    statusMessage.textContent = 'Please save your profile first!';
                    setTimeout(() => statusMessage.textContent = '', 2000);
                    return;
                }
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                }, () => {
                    chrome.tabs.sendMessage(tab.id, {
                        action: "FILL_FORM",
                        data: data.userProfile
                    });
                });
            });
        }
    });

    // Initial load
    loadProfile();
});

