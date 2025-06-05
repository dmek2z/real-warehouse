-- TAD STORY 냉동 창고 관리 시스템 데이터베이스 스키마
-- 이 파일을 Supabase Dashboard의 SQL Editor에서 실행하세요

-- 1. 카테고리 테이블
CREATE TABLE IF NOT EXISTS categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 품목 코드 테이블
CREATE TABLE IF NOT EXISTS product_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    storage_temp NUMERIC DEFAULT -18,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 사용자 테이블 (Supabase Auth와 연동)
CREATE TABLE IF NOT EXISTS users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    permissions JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 랙 테이블
CREATE TABLE IF NOT EXISTS racks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    capacity INTEGER DEFAULT 4,
    line TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 제품 테이블 (실제 재고 인스턴스)
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL REFERENCES product_codes(code) ON DELETE RESTRICT,
    inbound_at TIMESTAMPTZ DEFAULT NOW(),
    outbound_at TIMESTAMPTZ,
    weight NUMERIC NOT NULL,
    manufacturer TEXT NOT NULL,
    floor INTEGER CHECK (floor >= 1 AND floor <= 4),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 랙-제품 관계 테이블 (Many-to-Many)
CREATE TABLE IF NOT EXISTS rack_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rack_id UUID NOT NULL REFERENCES racks(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    floor INTEGER NOT NULL CHECK (floor >= 1 AND floor <= 4),
    inbound_date TIMESTAMPTZ DEFAULT NOW(),
    outbound_date TIMESTAMPTZ,
    UNIQUE(rack_id, product_id)
);

-- 7. 활동 로그 테이블
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    rack_id UUID REFERENCES racks(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    quantity INTEGER,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 트리거 함수: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 적용
CREATE TRIGGER update_product_codes_updated_at 
    BEFORE UPDATE ON product_codes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) 활성화
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE racks ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE rack_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS 정책 생성 (기본적으로 인증된 사용자만 접근 가능)
-- 카테고리
CREATE POLICY "Users can view categories" ON categories FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert categories" ON categories FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update categories" ON categories FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete categories" ON categories FOR DELETE USING (auth.role() = 'authenticated');

-- 품목 코드
CREATE POLICY "Users can view product_codes" ON product_codes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert product_codes" ON product_codes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update product_codes" ON product_codes FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete product_codes" ON product_codes FOR DELETE USING (auth.role() = 'authenticated');

-- 사용자
CREATE POLICY "Users can view users" ON users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert users" ON users FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update users" ON users FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete users" ON users FOR DELETE USING (auth.role() = 'authenticated');

-- 랙
CREATE POLICY "Users can view racks" ON racks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert racks" ON racks FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update racks" ON racks FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete racks" ON racks FOR DELETE USING (auth.role() = 'authenticated');

-- 제품
CREATE POLICY "Users can view products" ON products FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert products" ON products FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update products" ON products FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete products" ON products FOR DELETE USING (auth.role() = 'authenticated');

-- 랙-제품 관계
CREATE POLICY "Users can view rack_products" ON rack_products FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert rack_products" ON rack_products FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update rack_products" ON rack_products FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete rack_products" ON rack_products FOR DELETE USING (auth.role() = 'authenticated');

-- 활동 로그
CREATE POLICY "Users can view activity_logs" ON activity_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert activity_logs" ON activity_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_product_codes_code ON product_codes(code);
CREATE INDEX IF NOT EXISTS idx_product_codes_category_id ON product_codes(category_id);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_inbound_at ON products(inbound_at);
CREATE INDEX IF NOT EXISTS idx_racks_name ON racks(name);
CREATE INDEX IF NOT EXISTS idx_racks_line ON racks(line);
CREATE INDEX IF NOT EXISTS idx_rack_products_rack_id ON rack_products(rack_id);
CREATE INDEX IF NOT EXISTS idx_rack_products_product_id ON rack_products(product_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 샘플 데이터 삽입
INSERT INTO categories (name) VALUES 
    ('냉동육류'),
    ('냉동수산물'),
    ('냉동과일'),
    ('냉동채소'),
    ('기타')
ON CONFLICT (name) DO NOTHING;

-- 샘플 품목 코드
INSERT INTO product_codes (code, name, description, category_id, storage_temp) VALUES
    ('BEEF001', '소고기 등심', '프리미엄 소고기 등심 1kg', (SELECT id FROM categories WHERE name = '냉동육류'), -18),
    ('FISH001', '연어 필렛', '노르웨이산 연어 필렛 500g', (SELECT id FROM categories WHERE name = '냉동수산물'), -18),
    ('FRUIT001', '냉동 딸기', '국산 냉동 딸기 1kg', (SELECT id FROM categories WHERE name = '냉동과일'), -18),
    ('VEG001', '냉동 브로콜리', '냉동 브로콜리 500g', (SELECT id FROM categories WHERE name = '냉동채소'), -18)
ON CONFLICT (code) DO NOTHING;

-- 샘플 랙
INSERT INTO racks (name, line, capacity) VALUES
    ('A01', 'A', 4),
    ('A02', 'A', 4),
    ('B01', 'B', 4),
    ('B02', 'B', 4),
    ('C01', 'C', 4),
    ('C02', 'C', 4)
ON CONFLICT (name) DO NOTHING;

-- 실시간 구독을 위한 Publication 생성
-- (Supabase는 기본적으로 realtime을 지원하지만, 명시적으로 설정할 수 있습니다)
ALTER PUBLICATION supabase_realtime ADD TABLE categories;
ALTER PUBLICATION supabase_realtime ADD TABLE product_codes;
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE racks;
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE rack_products;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_logs; 