import sqlite3
import json
import datetime
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'crm.db')

def insert_content_post(week, post_date, slot_time, page, pillar, format, hook, body, hashtags, brief, status='drafted', source='marketing_hub'):
    """Insert a content post into the CRM content_posts table."""
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    cursor = db.cursor()
    
    cursor.execute("""
        INSERT INTO content_posts (week, post_date, slot_time, page, pillar, format, hook, body, hashtags, brief, status, source, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    """, (week, post_date, slot_time, page, pillar, format, hook, body, hashtags, brief, status, source))
    
    post_id = cursor.lastrowid
    db.commit()
    db.close()
    return post_id

def get_week_key():
    """Generate the current week key (e.g., 2026-06-W3)."""
    now = datetime.datetime.now()
    week_num = (now.day - 1) // 7 + 1
    return f"{now.year}-{now.month:02d}-W{week_num}"

def seed_sample_content():
    """Seed sample content for the current week so the calendar shows data."""
    week = get_week_key()
    
    posts = [
        {
            'post_date': datetime.date.today().strftime('%Y-%m-%d'),
            'slot_time': '09:00',
            'page': 'china',
            'pillar': 'scholarship',
            'format': 'carousel',
            'hook': '100% Full Scholarship in China — No Payment Before Visa!',
            'body': '🎓 চীনে 100% ফ্রি স্কলারশিপে পড়াশোনা করুন! টিউশন ফ্রি, হোস্টেল ফ্রি, মাসে স্টাইপেন্ড।\n\n✅ Payment After Visa — ভিসা না হলে ১ টাকাও দিতে হবে না!\n✅ 2000+ সফল প্লেসমেন্ট\n✅ 7+ বছরের অভিজ্ঞতা\n\n📞 +8801983333566\n📍 Plot-12/1, Road-4/A, Dhanmondi, Dhaka',
            'hashtags': '#StudyInChina #FullScholarship #EduExpress #BangladeshToChina #CSCScholarship',
            'brief': 'Trust-building carousel for students and parents. Lead with Payment After Visa guarantee.'
        },
        {
            'post_date': datetime.date.today().strftime('%Y-%m-%d'),
            'slot_time': '15:00',
            'page': 'bd',
            'pillar': 'trust',
            'format': 'video',
            'hook': 'Why 2000+ Students Trust EduExpress for Study Abroad',
            'body': 'EduExpress International — 7+ years, 2000+ placements, 100% Payment After Visa policy.\n\n🎓 China | Korea | Malaysia | Europe | Hungary | Malta | Cyprus | Georgia\n\n📞 FREE Counseling: +8801983333566\n📍 Dhanmondi, Dhaka',
            'hashtags': '#EduExpress #StudyAbroad #PaymentAfterVisa #Bangladesh',
            'brief': 'Social proof video showcasing trust and track record.'
        },
        {
            'post_date': (datetime.date.today() + datetime.timedelta(days=1)).strftime('%Y-%m-%d'),
            'slot_time': '09:00',
            'page': 'tiktok',
            'pillar': 'urgency',
            'format': 'reels',
            'hook': 'CSCA-Free Bachelor Admission — Last Chance!',
            'body': '⏳ CSCA ছাড়াই Bachelor করার শেষ সুযোগ!\n\n✅ 30+ universities without CSCA\n✅ Full scholarship available\n✅ No IELTS required\n\n📞 +8801983333566\n📍 Dhanmondi, Dhaka',
            'hashtags': '#CSCAFree #BachelorInChina #EduExpress #Scholarship2026',
            'brief': 'Urgency-driven Reels for TikTok/Instagram. CSCA-free last chance messaging.'
        }
    ]
    
    inserted_ids = []
    for p in posts:
        pid = insert_content_post(
            week=week,
            post_date=p['post_date'],
            slot_time=p['slot_time'],
            page=p['page'],
            pillar=p['pillar'],
            format=p['format'],
            hook=p['hook'],
            body=p['body'],
            hashtags=p['hashtags'],
            brief=p['brief'],
            status='drafted',
            source='marketing_hub'
        )
        inserted_ids.append(pid)
        print(f"✅ Inserted post {pid}: {p['hook'][:50]}...")
    
    print(f"\n✅ Total {len(inserted_ids)} posts inserted into week {week}")
    print(f"📊 content_posts now has {count_posts()} rows")
    return inserted_ids

def count_posts():
    db = sqlite3.connect(DB_PATH)
    cursor = db.cursor()
    cursor.execute("SELECT COUNT(*) FROM content_posts")
    count = cursor.fetchone()[0]
    db.close()
    return count

def list_posts(limit=10):
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    cursor = db.cursor()
    cursor.execute("SELECT id, week, post_date, slot_time, page, pillar, status, hook FROM content_posts ORDER BY id DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    db.close()
    return rows

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 EDUEXPRESS CRM CONTENT SEEDER")
    print("=" * 60)
    print(f"\n📁 Database: {DB_PATH}")
    print(f"📊 Current posts: {count_posts()}")
    
    if count_posts() == 0:
        print("\n⚠️  content_posts is empty. Seeding sample content...")
        seed_sample_content()
    else:
        print(f"\n✅ content_posts already has {count_posts()} rows. Showing latest:")
        for row in list_posts(5):
            print(f"  #{row['id']} | {row['week']} | {row['page']} | {row['status']} | {row['hook'][:40]}...")
    
    print("\n" + "=" * 60)
    print("Done. Refresh the CRM Marketing Hub calendar to see the posts.")
    print("=" * 60)
