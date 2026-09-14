import base64
import json
import unittest
from unittest.mock import patch
import community_feed as feed

SMALL_PNG=base64.b64encode(bytes.fromhex('89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415478da6360606060000000050001a5f645400000000049454e44ae426082')).decode()

class CommunityFeedTests(unittest.TestCase):
 def setUp(self):
  self.store={}
  patcher_get=patch.object(feed.store,'get',side_effect=lambda k:self.store.get(k))
  patcher_set=patch.object(feed.store,'set',side_effect=self._fake_set)
  self.addCleanup(patcher_get.stop);self.addCleanup(patcher_set.stop)
  patcher_get.start();patcher_set.start()
 def _fake_set(self,k,v):
  self.store[k]=v;return True
 def test_create_and_list_post(self):
  post=feed.create_post('u1','Santos','Locked in this parlay')
  self.assertEqual(feed.list_posts(),[post])
  self.assertEqual(post['authorName'],'Santos')
  self.assertIsNone(post['imageId'])
 def test_create_post_requires_text_or_image(self):
  with self.assertRaises(ValueError):feed.create_post('u1','Santos','')
 def test_create_post_rejects_overlong_text(self):
  with self.assertRaises(ValueError):feed.create_post('u1','Santos','x'*501)
 def test_create_post_with_image_stores_and_reads_it(self):
  post=feed.create_post('u1','Santos','check this slip',f'data:image/png;base64,{SMALL_PNG}')
  record=feed.read_image(post['imageId'])
  self.assertEqual(record['contentType'],'image/png')
 def test_create_post_rejects_bad_image(self):
  with self.assertRaises(ValueError):feed.create_post('u1','Santos','text','not-an-image')
 def test_toggle_reaction_adds_and_removes(self):
  post=feed.create_post('u1','Santos','play')
  updated=feed.toggle_reaction(post['id'],'🔥','u2')
  self.assertEqual(updated['reactions']['🔥'],['u2'])
  updated=feed.toggle_reaction(post['id'],'🔥','u2')
  self.assertNotIn('🔥',updated['reactions'])
 def test_toggle_reaction_rejects_unknown_emoji(self):
  post=feed.create_post('u1','Santos','play')
  with self.assertRaises(ValueError):feed.toggle_reaction(post['id'],'🍕','u2')
 def test_toggle_reaction_missing_post(self):
  with self.assertRaises(ValueError):feed.toggle_reaction('missing','🔥','u2')
 def test_delete_post_by_author(self):
  post=feed.create_post('u1','Santos','play')
  feed.delete_post(post['id'],'u1',False)
  self.assertEqual(feed.list_posts(),[])
 def test_delete_post_by_admin(self):
  post=feed.create_post('u1','Santos','play')
  feed.delete_post(post['id'],'admin',True)
  self.assertEqual(feed.list_posts(),[])
 def test_delete_post_rejects_non_author_non_admin(self):
  post=feed.create_post('u1','Santos','play')
  with self.assertRaises(ValueError):feed.delete_post(post['id'],'u2',False)
  self.assertEqual(len(feed.list_posts()),1)
 def test_posts_capped_at_max(self):
  for i in range(feed.MAX_POSTS+5):
   self.store[feed.KEY]=json.dumps([{'id':str(i),'authorId':'u1','authorName':'S','text':'x','imageId':None,'createdAt':0,'reactions':{}} for i in range(feed.MAX_POSTS+5)])
  feed.create_post('u1','Santos','newest')
  self.assertLessEqual(len(feed.list_posts()),feed.MAX_POSTS)

if __name__=='__main__':
 unittest.main()
