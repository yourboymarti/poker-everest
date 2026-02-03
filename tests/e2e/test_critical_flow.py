import pytest
from playwright.sync_api import Page, expect

BASE_URL = "http://localhost:3000"

def test_full_poker_flow(page: Page):
    # 1. Create a Room
    page.goto(BASE_URL)
    expect(page.get_by_text("Everest Poker")).to_be_visible()
    
    page.get_by_placeholder("e.g. Sprint 32 Planning").fill("Test Sprint")
    page.get_by_role("button", name="Start Game").click()
    
    # Wait for redirect to room
    page.wait_for_url("**/?room=*")
    
    # 2. Join the Room as Admin
    page.get_by_placeholder("e.g. Sherpa John").fill("Admin User")
    page.get_by_role("button", name="Enter Room").click()
    
    # Verify we are in the room
    expect(page.get_by_text("Test Sprint")).to_be_visible()
    expect(page.get_by_role("button", name="Add a task")).to_be_visible()
    
    # 3. Add a Task
    page.get_by_role("button", name="Add a task").click()
    page.get_by_placeholder("Enter a title for the task").fill("Feature: Auth")
    page.get_by_role("button", name="Save").click()
    
    expect(page.get_by_text("Feature: Auth")).to_be_visible()
    
    # 4. Start Voting
    page.get_by_title("Start Voting").click()
    expect(page.get_by_text("Pick your card")).to_be_visible()
    
    # 5. Vote
    page.get_by_role("button", name="5", exact=True).click()
    expect(page.get_by_text("1/1 voted")).to_be_visible()
    
    # 6. Reveal
    page.get_by_role("button", name="Reveal Cards").click()
    expect(page.get_by_text("5.0")).to_be_visible()
    expect(page.get_by_text("Average")).to_be_visible()
    
    # 7. Delete Task and Undo
    # Ensure Sidebar is open (it should be by default)
    page.get_by_title("Delete Task").click()
    # Click confirmation alert circle (Trash icon changes to AlertCircle)
    page.get_by_title("Click again to confirm").click()
    
    displaying_feature_task_in_notification = page.get_by_text("Feature: Auth")
    # expect(displaying_feature_task_in_notification).to_be_visible() # Notification is visible
    
    # Check that sidebar list is empty
    expect(page.get_by_text("No tasks yet")).to_be_visible()
    
    expect(page.get_by_text("Задача удалена")).to_be_visible()
    
    # Undo
    page.get_by_role("button", name="ОТМЕНИТЬ").click()
    expect(page.get_by_text("Feature: Auth")).to_be_visible()

@pytest.fixture(scope="session", autouse=True)
def setup_playwright(playwright):
    # browser = playwright.chromium.launch()
    # yield
    # browser.close()
    pass
