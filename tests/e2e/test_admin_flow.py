import pytest
from playwright.sync_api import Page, BrowserContext, expect

BASE_URL = "http://localhost:3000"

def test_admin_persistence_and_multi_user(browser: BrowserContext):
    # Create two isolated contexts for two different users
    context_admin = browser.new_context()
    context_user = browser.new_context()
    
    page_admin = context_admin.new_page()
    page_user = context_user.new_page()

    # --- 1. Admin creates the room ---
    page_admin.goto(BASE_URL)
    page_admin.get_by_placeholder("e.g. Sprint 32 Planning").fill("Admin Verification")
    page_admin.get_by_role("button", name="Start Game").click()
    page_admin.wait_for_url("**/?room=*")
    room_url = page_admin.url
    
    # Configure Admin
    page_admin.get_by_placeholder("e.g. Sherpa John").fill("The Admin")
    page_admin.get_by_role("button", name="Enter Room").click()
    
    # Assert Admin rights
    # The user list item usually contains "The Admin" and maybe a host icon
    expect(page_admin.get_by_text("The Admin").first).to_be_visible()
    expect(page_admin.get_by_role("button", name="Add a task")).to_be_visible()
    
    # --- 2. User joins the room ---
    page_user.goto(room_url)
    page_user.get_by_placeholder("e.g. Sherpa John").fill("Regular User")
    page_user.get_by_role("button", name="Enter Room").click()
    
    # Assert User visibility
    expect(page_user.get_by_text("The Admin").first).to_be_visible()
    expect(page_user.get_by_text("Regular User").first).to_be_visible()
    
    # Assert User does NOT have admin rights
    expect(page_user.get_by_role("button", name="Add a task")).not_to_be_visible()
    
    # --- 3. Admin Refresh Persistence ---
    page_admin.reload()
    # Should still skip login because of local storage, or re-ask name? 
    # Current implementation might ask name again if not handled, but let's see.
    # Actually, if we just reload, we might land on join screen again depending on implementation.
    # Let's check if we need to enter name again.
    if page_admin.get_by_placeholder("e.g. Sherpa John").is_visible():
        page_admin.get_by_placeholder("e.g. Sherpa John").fill("The Admin")
        page_admin.get_by_role("button", name="Enter Room").click()
        
    expect(page_admin.get_by_text("The Admin").first).to_be_visible()
    expect(page_admin.get_by_role("button", name="Add a task")).to_be_visible() # STILL ADMIN
    
    # --- 4. User Refresh Persistence ---
    page_user.reload()
    if page_user.get_by_placeholder("e.g. Sherpa John").is_visible():
        page_user.get_by_placeholder("e.g. Sherpa John").fill("Regular User")
        page_user.get_by_role("button", name="Enter Room").click()
        
    expect(page_user.get_by_role("button", name="Add a task")).not_to_be_visible() # STILL NOT ADMIN
    
    # --- 5. Game Flow Check (10 people simulation - scaled down to 2 active + assumptions) ---
    # Admin Adds Task
    page_admin.get_by_role("button", name="Add a task").click()
    page_admin.get_by_placeholder("Enter a title for the task").fill("Scale Test")
    page_admin.get_by_role("button", name="Save").click()
    
    # Start Voting
    page_admin.get_by_title("Start Voting").click()
    
    # Both vote
    page_admin.get_by_role("button", name="5", exact=True).click()
    page_user.get_by_role("button", name="8", exact=True).click()
    
    # Reveal
    page_admin.get_by_role("button", name="Reveal Cards").click()
    
    # Verify Results
    expect(page_admin.get_by_text("6.5")).to_be_visible() # Average
    expect(page_user.get_by_text("6.5")).to_be_visible()
    
    # End Round Check
    expect(page_admin.get_by_role("button", name="END ROUND")).to_be_visible()
    expect(page_user.get_by_role("button", name="END ROUND")).not_to_be_visible()
    
    page_admin.get_by_role("button", name="END ROUND").click()
    expect(page_admin.get_by_text("Add a task to start...")).to_be_visible()

